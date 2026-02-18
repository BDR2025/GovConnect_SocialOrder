/* social_order_v0.18.6 · apps/so_batch (ESM)
   Bestelllauf-Ansicht + Bündelungslogik.
   Abhängigkeiten werden über ctx injiziert, damit app.js schlank bleibt.
*/

export function mountBatch(ctx){
  const {
    state,
    permissions,
    visibleOrdersForCurrentUser,
    saveState,
    orderTotal,
    orderVendors,
    orderOrgLabel,
    splitParts,
    syncAggregate,
    pushActivity,
    vendorPolicy,
    contractInfo,
    statusTag,
    costCenterLabel,
    ZB_SHIPPING_COSTCENTER,
    INTERNAL_COSTCENTERS,
    COSTCENTER_BY_CODE,
    openOrderDetails,
    openModal,
    closeModal,
    nowIso,
    escapeHtml,
    util
  } = ctx;

  const inEl = document.getElementById("batch-in");
  const outEl = document.getElementById("batch-out");
  const btn = document.getElementById("btn-run-batch");

  const caps = permissions();
  if(!caps.canBatch){
    inEl.innerHTML = `<div class="callout"><div class="callout__title">Keine Berechtigung</div><div class="callout__text">Diese Ansicht ist für die <strong>Zentrale Beschaffung</strong> gedacht.</div></div>`;
    outEl.innerHTML = "";
    if(btn) btn.disabled = true;
    return;
  }

  function eligible(){
    const base = visibleOrdersForCurrentUser(state.orders || []);
    return base.filter(o => String(o.status || "") === "Freigegeben");
  }

  function currentBatch(){
    return state.ui.lastBatch && state.ui.lastBatch.groups ? state.ui.lastBatch : null;
  }

  function renderIn(){
    const list = eligible();
    if(list.length === 0){
  	        const last = currentBatch();
  	        if(last && Array.isArray(last.orderIds) && last.orderIds.length){
  	          const stamp = last.at ? util.dt(last.at) : "–";
  	          const chips = last.orderIds.map(id=> `<span class="pill">${escapeHtml(id)}</span>`).join(" ");
  	          inEl.innerHTML = `
  	            <div class="callout">
  	              <div class="callout__title">Keine freigegebenen Anforderungen</div>
  	              <div class="callout__text">Aktuell gibt es nichts zu bündeln. Letzter Bestelllauf: <strong>${escapeHtml(stamp)}</strong> (${last.orderIds.length} Anforderungen) – Ergebnis siehe rechts.</div>
  	            </div>
  	            <div class="row" style="gap:8px; flex-wrap:wrap; margin-top:10px;">${chips}</div>
  	          `;
  	        }else{
  	          inEl.innerHTML = `<div class="callout"><div class="callout__title">Keine freigegebenen Anforderungen</div><div class="callout__text">Es gibt aktuell nichts zu bündeln. Freigegebene Anforderungen erscheinen hier.</div></div>`;
  	        }
      return;
    }

    // Lieferanten-Vorschau (pro Lieferant: wie viele Anforderungen betroffen sind)
    const counts = {};
    for(const o of list){
      const vs = orderVendors(o);
      const uniq = Array.from(new Set(vs));
      for(const v of uniq){
        counts[v] = (counts[v] || 0) + 1;
      }
    }
    const chips = Object.entries(counts)
      .sort((a,b)=> b[1]-a[1])
      .map(([v,c])=> `<span class="pill">${escapeHtml(v)} · ${c}</span>`)
      .join(" ");

    const summary = `
      <div class="muted small" style="margin-bottom:8px;">Lieferanten im nächsten Bestelllauf</div>
      <div class="row" style="gap:8px; flex-wrap:wrap; margin-bottom:10px;">${chips}</div>
    `;

    inEl.innerHTML = summary + list.map(o=>{
      const total = orderTotal(o);
      const vs = orderVendors(o);
      const vHint = (vs.length <= 2) ? vs.join(", ") : `${vs[0]}, ${vs[1]} + ${vs.length-2}`;
      return `
        <div class="cartRow">
          <div>
            <div class="cartRow__title">${escapeHtml(o.id)}</div>
            <div class="cartRow__meta">
              ${escapeHtml(orderOrgLabel(o))} · ${escapeHtml(util.dt(o.createdAt))} ·
              <strong>${escapeHtml(vs.length === 1 ? vs[0] : `${vs.length} Lieferanten`)}</strong>
              ${vs.length > 1 ? `<span class="muted">(${escapeHtml(vHint)})</span>` : ""}
            </div>
          </div>
          <div class="pill">${escapeHtml(util.eur(total))}</div>
        </div>
      `;
    }).join("");
  }

  function nextPo(){
    const year = new Date().getFullYear();
    const n = state.ui.poSeq || 2001;
    state.ui.poSeq = n + 1;
    saveState();
    return `PO-${year}-${String(n).padStart(4,"0")}`;
  }

  function normalizeGroupShape(g){
    if(!g) return g;
    if(!g.status) g.status = "Im Bestelllauf";
    if(!Array.isArray(g.orderIds)) g.orderIds = [];
    if(typeof g.total !== "number") g.total = Number(g.total || 0);
    if(typeof g.orderCount !== "number") g.orderCount = g.orderIds.length;
    if(typeof g.lineCount !== "number") g.lineCount = Number(g.lineCount || 0);
    if(typeof g.qty !== "number") g.qty = Number(g.qty || 0);
    if(!g.trigger) g.trigger = "";
    if(typeof g.shippingFee !== "number") g.shippingFee = Number(g.shippingFee || 0);
    if(!Array.isArray(g.shippingAllocations)) g.shippingAllocations = [];
    return g;
  }

  function vendorSubtotalForOrder(order, vendor){
    const parts = splitParts(order);
    const p = parts.find(x=>String(x.vendor) === String(vendor));
    return p ? Number(p.total || 0) : 0;
  }

  function costCenterTotalsForVendorGroup(vendor, orderIds, predicate){
    const m = {};
    for(const id of (orderIds || [])){
      const o = (state.orders || []).find(x=>x.id===id);
      if(!o) continue;
      if(predicate && !predicate(o)) continue;
      const cc = String(o.costCenter || "").trim();
      if(!cc) continue;
      const sub = vendorSubtotalForOrder(o, vendor);
      if(sub <= 0) continue;
      m[cc] = Number(((m[cc] || 0) + sub).toFixed(2));
    }
    return m;
  }

  function proportionalAllocations(amount, totalsByCc){
    const amt = Number(amount || 0);
    const entries = Object.entries(totalsByCc || {}).filter(([,v])=> Number(v) > 0);
    if(!amt || entries.length === 0) return [];

    // Sort by contribution (largest first) to distribute remainder cents predictably.
    const rows = entries.map(([cc,v])=> ({ cc, v: Number(v) })).sort((a,b)=> b.v - a.v);
    const sum = rows.reduce((s,r)=> s + r.v, 0);
    if(sum <= 0) return [];

    let allocs = rows.map(r=>{
      const raw = amt * (r.v / sum);
      const floored = Math.floor(raw * 100) / 100;
      return { costCenter: r.cc, amount: Number(floored.toFixed(2)) };
    });

    const amtCents = Math.round(amt * 100);
    const allocatedCents = allocs.reduce((s,a)=> s + Math.round(Number(a.amount) * 100), 0);
    let rem = amtCents - allocatedCents;
    for(let i=0; i<rem; i++){
      const idx = i % allocs.length;
      allocs[idx].amount = Number((allocs[idx].amount + 0.01).toFixed(2));
    }
    return allocs;
  }

  function triggerLabel(t){
    const k = String(t||"");
    if(k === "urgent") return "Dringend";
    if(k === "zb_override") return "ZB-Override";
    if(k === "standard_under_mbw") return "Standard (unter MBW)";
    return "Standard";
  }

  function costCenterShortLabel(code, maxNameChars){
    const key = String(code||"").trim();
    const c = INTERNAL_COSTCENTERS[key] || COSTCENTER_BY_CODE[key];
    if(!c) return key ? String(key) : "–";
    const codeOut = c.code || key;
    const nm = String(c.name||"").trim();
    if(!nm) return codeOut;
    const maxN = (typeof maxNameChars === "number" && maxNameChars > 4) ? maxNameChars : 12;
    let short = nm;
    if(short.length > maxN) short = short.slice(0, maxN).trimEnd() + "…";
    return `${codeOut} · ${short}`;
  }

  function allocationTargetTooltip(allocs){
    const arr = Array.isArray(allocs) ? allocs : [];
    if(arr.length === 0) return "";
    return arr
      .filter(a=>a && a.costCenter)
      .map(a=>{
        const cc = costCenterLabel(a.costCenter);
        const amt = (typeof a.amount === "number") ? util.eur(a.amount) : "";
        return amt ? `${cc}: ${amt}` : cc;
      })
      .join("\n");
  }

  function allocationTargetShort(allocs, withAmounts){
    const arr = Array.isArray(allocs) ? allocs : [];
    if(arr.length === 0) return "–";

    const showAmts = !!withAmounts && arr.length > 1;
    const parts = arr
      .filter(a=>a && a.costCenter)
      .map(a=>{
        const cc = String(a.costCenter||"").trim();
        const lbl = costCenterShortLabel(cc, 12);
        const amt = (showAmts && typeof a.amount === "number") ? ` (${util.eur(a.amount)})` : "";
        return `${lbl}${amt}`;
      })
      .filter(Boolean);

    if(parts.length === 0) return "–";

    const joined = parts.join(", ");
    const maxLen = showAmts ? 70 : 46;
    if(joined.length <= maxLen) return joined;
    if(parts.length === 1){
      return joined.length <= maxLen ? joined : (joined.slice(0, maxLen-1) + "…");
    }
    return `${parts.length} Kostenstellen`;
  }

  function renderOut(batch){
    if(!batch){
      outEl.innerHTML = `<div class="cart__empty">Noch kein Bestelllauf ausgeführt. Klicken Sie auf „Bestelllauf simulieren“, um freigegebene Anforderungen zu bündeln.</div>`;
      return;
    }

    const groups = batch.groups || {};
    const entries = Object.entries(groups).map(([vendor,g])=> [vendor, normalizeGroupShape(g)]);

    if(entries.length === 0){
      outEl.innerHTML = `<div class="cart__empty">Keine Gruppen vorhanden.</div>`;
      return;
    }

  	      // Summary
    const supplierCount = entries.length;
    const totalOrders = batch.orderCount || (batch.orderIds ? batch.orderIds.length : 0);
  	      const stamp = batch.at ? util.dt(batch.at) : "–";

    outEl.innerHTML = `
      <div class="callout">
  	          <div class="callout__title">Bündelung (letzter Bestelllauf)</div>
  	          <div class="callout__text">Stand: <strong>${escapeHtml(stamp)}</strong> · Aus <strong>${totalOrders}</strong> Anforderungen wurden <strong>${supplierCount}</strong> Bestellungen (<strong>${supplierCount}</strong> Lieferanten).</div>
      </div>

      <div style="margin-top:10px;">
        ${entries.map(([vendor, g])=>{
          const po = g.poNumber ? ` · <strong>${escapeHtml(g.poNumber)}</strong>` : "";
          const contract = g.contract ? `${escapeHtml(g.contract)} · ` : "";
          const status = statusTag(g.status || "Im Bestelllauf");

          const pol = vendorPolicy(vendor);
          const mbw = pol.mbw;
          const gap = (typeof mbw === "number") ? Number(Math.max(0, mbw - g.total).toFixed(2)) : null;
          const orderIds = Array.isArray(g.orderIds) ? g.orderIds : [];
          const orders = orderIds.map(id => (state.orders || []).find(x=>x.id===id)).filter(Boolean);
          const urgentIds = orders.filter(o=>String(o.urgency||"") === "urgent").map(o=>o.id);
          const urgentCount = urgentIds.length;
          const costCenters = Array.from(new Set(orders.map(o=>String(o.costCenter||"").trim()).filter(Boolean)));

          const mbwPill = (typeof mbw === "number")
            ? (gap && gap > 0
                ? `<span class="pill pill--warn">MBW ${escapeHtml(util.eur(mbw))} · Fehlen ${escapeHtml(util.eur(gap))}</span>`
                : `<span class="pill pill--accent">MBW ${escapeHtml(util.eur(mbw))} · erreicht</span>`)
            : "";

          const shipPill = (g.status === "Im Bestelllauf" && typeof mbw === "number" && gap && gap > 0 && typeof pol.shippingFeeUnderMbw === "number")
            ? `<span class="pill pill--warn">Versand ${escapeHtml(util.eur(pol.shippingFeeUnderMbw))}</span>`
            : "";

          const urgentPill = urgentCount > 0 ? `<span class="pill pill--danger">Dringend: ${urgentCount}</span>` : "";

          const trigPill = (g.status !== "Im Bestelllauf" && g.trigger)
            ? `<span class="pill">Auslösung: ${escapeHtml(triggerLabel(g.trigger))}</span>`
            : "";

          const bookedShipPill = (g.status !== "Im Bestelllauf" && typeof g.shippingFee === "number" && g.shippingFee > 0)
            ? `<span class="pill pill--warn" title="${escapeHtml(allocationTargetTooltip(g.shippingAllocations))}">Versand gebucht: ${escapeHtml(util.eur(g.shippingFee))} → ${escapeHtml(allocationTargetShort(g.shippingAllocations, true))}</span>`
            : "";

          const pills = (mbwPill || shipPill || urgentPill || trigPill || bookedShipPill)
            ? `<div class="row" style="gap:8px; flex-wrap:wrap; margin-top:6px;">${mbwPill}${shipPill}${urgentPill}${trigPill}${bookedShipPill}</div>`
            : "";


          const soChips = orderIds.map(id=>
            `<button type="button" class="chip" data-open-order="${escapeHtml(id)}">${escapeHtml(id)}</button>`
          ).join("");

          const ccChips = costCenters.map(cc=>
            `<span class="chip" title="${escapeHtml(costCenterLabel(cc))}">${escapeHtml(costCenterShortLabel(cc, 18))}</span>`
          ).join("");

          const cinfo = contractInfo(g.contract || "");
          const contractDetails = cinfo ? `
            <details class="details" style="margin-top:10px;">
              <summary>${escapeHtml(g.contract)} · Lieferbedingungen</summary>
              <div class="small" style="margin-top:8px; line-height:1.35;">
                <div><strong>Lieferant:</strong> ${escapeHtml(vendor)}</div>
                ${cinfo.scope ? `<div><strong>Leistung:</strong> ${escapeHtml(cinfo.scope)}</div>` : ""}
                ${(typeof mbw === "number") ? `<div><strong>Mindestbestellwert:</strong> ${escapeHtml(util.eur(mbw))}${(gap && gap > 0) ? ` (Fehlen ${escapeHtml(util.eur(gap))})` : " (erreicht)"}</div>` : ""}
                ${(typeof pol.shippingFeeUnderMbw === "number") ? `<div><strong>Versand:</strong> ${escapeHtml(util.eur(pol.shippingFeeUnderMbw))} unter MBW</div>` : ""}
                ${cinfo.delivery ? `<div><strong>Lieferzeit:</strong> ${escapeHtml(cinfo.delivery)}</div>` : ""}
                ${cinfo.shipTo ? `<div><strong>Belieferung:</strong> ${escapeHtml(cinfo.shipTo)}</div>` : ""}
                ${cinfo.packing ? `<div><strong>Pack/Label:</strong> ${escapeHtml(cinfo.packing)}</div>` : ""}
                ${cinfo.invoice ? `<div><strong>Rechnung:</strong> ${escapeHtml(cinfo.invoice)}</div>` : ""}
                ${cinfo.notes ? `<div class="muted small" style="margin-top:6px;">${escapeHtml(cinfo.notes)}</div>` : ""}
              </div>

              <div class="muted small" style="margin-top:10px;">Anforderungen (${orderIds.length})</div>
              <div class="filters" style="margin-top:6px;">${soChips || `<span class="muted small">–</span>`}</div>

              <div class="muted small" style="margin-top:10px;">Kostenstellen</div>
              <div class="filters" style="margin-top:6px;">${ccChips || `<span class="muted small">–</span>`}</div>

              ${urgentIds.length ? `
                <div class="muted small" style="margin-top:10px;">Dringend</div>
                <div class="filters" style="margin-top:6px;">${urgentIds.map(id=>`<button type="button" class="chip" data-open-order="${escapeHtml(id)}">${escapeHtml(id)}</button>`).join("")}</div>
              ` : ""}
            </details>
          ` : "";

          const actions =
            (g.status === "Im Bestelllauf") ? `<button class="btn btn--primary" data-place="${escapeHtml(vendor)}">Bestellung auslösen</button>`
            : (g.status === "Bestellt") ? `<button class="btn btn--primary" data-complete="${escapeHtml(vendor)}">Als abgeschlossen markieren</button>`
            : `<span class="muted small">Abgeschlossen</span>`;

          return `
            <div class="item" style="margin-bottom:10px;">
              <div style="min-width:0;">
                <div class="item__title">${escapeHtml(vendor)} ${status}</div>
                <div class="item__meta">${contract}${g.orderCount} Anforderungen · ${g.lineCount} Positionen · ${escapeHtml(util.eur(g.total))}${po}</div>
                ${pills}
                ${contractDetails}
              </div>
              <div class="item__right" style="gap:10px;">
                ${actions}
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <div class="muted small" style="margin-top:10px;">
        Hinweis: Eine Anforderung kann mehrere Lieferanten enthalten. Der Bestelllauf splittet automatisch in Teilbestellungen pro Lieferant.
      </div>
    `;

    outEl.querySelectorAll("[data-place]").forEach(b=>{
      b.addEventListener("click", ()=> placeVendor(batch, b.getAttribute("data-place")));
    });
    outEl.querySelectorAll("[data-complete]").forEach(b=>{
      b.addEventListener("click", ()=> completeVendor(batch, b.getAttribute("data-complete")));
    });

    outEl.querySelectorAll("[data-open-order]").forEach(b=>{
      b.addEventListener("click", (ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        const id = b.getAttribute("data-open-order");
        const all = [].concat(state.orders || [], state.historyOrders || []);
        const o = all.find(x=>String(x.id)===String(id)) || null;
        if(o) openOrderDetails(o);
      });
    });
  }

  function run(){
    const list = eligible();
    if(list.length === 0){
      openModal(`<div class="callout"><div class="callout__title">Nichts zu tun</div><div class="callout__text">Keine freigegebenen Anforderungen vorhanden.</div></div>`);
      return;
    }

    const groups = {};
    const now = nowIso();

    for(const o of list){
      const byVendor = {};

      for(const it of (o.items || [])){
        const v = it.vendor || "Unbekannt";
        if(!byVendor[v]) byVendor[v] = { contract: it.contract || "", total: 0, lineCount: 0, qty: 0 };
        byVendor[v].total += Number(it.price) * Number(it.qty || 0);
        byVendor[v].lineCount += 1;
        byVendor[v].qty += Number(it.qty || 0);
      }

      // Create/overwrite splits on the order (one part per vendor)
      o.splits = Object.entries(byVendor).map(([vendor, info])=>({
        vendor,
        contract: info.contract,
        status: "Im Bestelllauf",
        poNumber: null,
        total: Number(info.total.toFixed(2)),
        lineCount: info.lineCount,
        qty: info.qty
      }));

      // Parent status becomes aggregated (initially: "Im Bestelllauf")
      o.status = "Im Bestelllauf";
      syncAggregate(o);

      o.audit = o.audit || [];
      o.audit.push({ at: now, who: "Zentrale Beschaffung", what: "Bestelllauf gestartet" });

      // Build supplier groups for this batch
      for(const [vendor, info] of Object.entries(byVendor)){
        if(!groups[vendor]) groups[vendor] = { orderIds: [], orderCount: 0, lineCount: 0, qty: 0, total: 0, poNumber: null, contract: info.contract, status: "Im Bestelllauf" };
        if(!groups[vendor].orderIds.includes(o.id)){
          groups[vendor].orderIds.push(o.id);
          groups[vendor].orderCount += 1;
        }
        groups[vendor].lineCount += info.lineCount;
        groups[vendor].qty += info.qty;
        groups[vendor].total = Number((groups[vendor].total + info.total).toFixed(2));
      }

      // Activity: requester sees split fact
      const vCount = (o.splits || []).length;
      pushActivity({ text: `${o.id} im Bestelllauf (aufgeteilt in ${vCount} Lieferanten)`, orderId: o.id, audience: ["user"] });
    }

    state.ui.lastBatch = {
      at: now,
      orderIds: list.map(o=>o.id),
      groups,
      orderCount: list.length
    };

    saveState();
    renderIn();
    renderOut(state.ui.lastBatch);

    pushActivity({ text: `Bestelllauf gestartet: ${list.length} Anforderungen · ${Object.keys(groups).length} Lieferanten`, audience: ["central","lead"] });
  }

  function placeVendor(batch, vendor){
    if(!batch || !vendor) return;
    const g = batch.groups && batch.groups[vendor];
    if(!g) return;

    normalizeGroupShape(g);

    if(g.status !== "Im Bestelllauf") return;

    function commitPlaced(trigger, shippingFee, allocations){
      const trig = String(trigger || "standard");
      const ship = Number(shippingFee || 0);
      const allocs = Array.isArray(allocations) ? allocations : [];

      if(!g.poNumber){
        g.poNumber = nextPo();
      }
      g.status = "Bestellt";
      g.trigger = trig;
      g.shippingFee = ship;
      g.shippingAllocations = allocs;

      const now = nowIso();

      // Update related orders (only this vendor part)
      for(const id of (g.orderIds || [])){
        const o = state.orders.find(x=>x.id===id);
        if(!o) continue;

        const parts = splitParts(o);
        const p = parts.find(x=>String(x.vendor) === String(vendor));
        if(p){
          p.status = "Bestellt";
          p.poNumber = g.poNumber;
          p.trigger = trig;
          p.shippingFee = ship;
          p.shippingAllocations = allocs;
        }

        if(!o.poNumbers) o.poNumbers = [];
        if(!o.poNumbers.includes(g.poNumber)) o.poNumbers.push(g.poNumber);

        o.audit = o.audit || [];
        // Wichtig: Audit-Pattern für Dashboard stabil halten
        o.audit.push({ at: now, who: "Zentrale Beschaffung", what: `Bestellt: ${vendor} (${g.poNumber})` });
        if(ship > 0){
          const target = allocationTargetShort(allocs);
          o.audit.push({ at: now, who: "System", what: `Versandkosten: ${util.eur(ship)} → ${target} (${triggerLabel(trig)})` });
        }

        syncAggregate(o);
        pushActivity({ text: `${o.id}: Teilbestellung ${vendor} bestellt (${g.poNumber})`, orderId: o.id, audience: ["user"] });
      }

      batch.groups[vendor] = g;
      state.ui.lastBatch = batch;
      saveState();

      renderOut(batch);
      const shipTxt = ship > 0 ? ` · Versand ${util.eur(ship)} → ${allocationTargetShort(allocs)}` : "";
      pushActivity({ text: `Bestellung ausgelöst: ${vendor} (${g.poNumber})${shipTxt}`, audience: ["central","lead"] });
    }

    // MBW-Entscheidung (nur wenn unter MBW + Versandkosten bekannt)
    const pol = vendorPolicy(vendor);
    const mbw = pol.mbw;
    const shipFee = (typeof pol.shippingFeeUnderMbw === "number") ? Number(pol.shippingFeeUnderMbw) : 0;
    const gap = (typeof mbw === "number") ? Number(Math.max(0, mbw - g.total).toFixed(2)) : 0;

    if(typeof mbw === "number" && gap > 0 && shipFee > 0){
      const urgentIds = (g.orderIds || []).filter(id=>{
        const o = (state.orders || []).find(x=>x.id===id);
        return o && String(o.urgency||"") === "urgent";
      });
      const hasUrgent = urgentIds.length > 0;

      const html = `
        <div class="callout">
          <div class="callout__title">Mindestbestellwert nicht erreicht</div>
          <div class="callout__text">Für <strong>${escapeHtml(vendor)}</strong> fehlen <strong>${escapeHtml(util.eur(gap))}</strong> bis zum Mindestbestellwert (<strong>${escapeHtml(util.eur(mbw))}</strong>). Bei Auslösung fallen Versandkosten in Höhe von <strong>${escapeHtml(util.eur(shipFee))}</strong> an.</div>
        </div>

        <div class="muted small" style="margin-top:10px;">Bitte wählen Sie, wie die Auslösung begründet wird und auf welche Kostenstelle(n) die Versandkosten gebucht werden.</div>

        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:12px;">
          ${hasUrgent ? `<button class="btn btn--primary" id="btn-place-urgent">Auslösen wegen Dringend</button>` : ``}
          <button class="btn btn--primary" id="btn-place-override">ZB-Override auslösen</button>
          <button class="btn" id="btn-place-standard">Trotzdem auslösen (Standard)</button>
        </div>

        <ul class="bullets" style="margin-top:12px;">
          ${hasUrgent ? `<li><strong>Dringend</strong>: Versandkosten werden den dringlichen Kostenstellen zugeordnet.</li>` : ``}
          <li><strong>ZB-Override</strong>: Versandkosten werden der Kostenstelle <strong>${escapeHtml(costCenterLabel(ZB_SHIPPING_COSTCENTER))}</strong> zugeordnet.</li>
          <li><strong>Standard</strong>: Versandkosten werden proportional auf die beteiligten Kostenstellen verteilt.</li>
        </ul>
      `;

      openModal(html, { title: "Bestellung auslösen" });

      const root = document.getElementById("modal-body");
      if(!root) return;
      const btnStd = root.querySelector("#btn-place-standard");
      const btnOv = root.querySelector("#btn-place-override");
      const btnUrg = root.querySelector("#btn-place-urgent");

      if(btnStd) btnStd.addEventListener("click", ()=>{
        const totals = costCenterTotalsForVendorGroup(vendor, g.orderIds);
        const allocs = proportionalAllocations(shipFee, totals);
        closeModal();
        commitPlaced("standard_under_mbw", shipFee, allocs);
      });

      if(btnOv) btnOv.addEventListener("click", ()=>{
        const allocs = [{ costCenter: ZB_SHIPPING_COSTCENTER, amount: Number(shipFee.toFixed(2)) }];
        closeModal();
        commitPlaced("zb_override", shipFee, allocs);
      });

      if(btnUrg) btnUrg.addEventListener("click", ()=>{
        const totals = costCenterTotalsForVendorGroup(vendor, g.orderIds, (o)=> String(o.urgency||"") === "urgent");
        let allocs = proportionalAllocations(shipFee, totals);
        // Fallback: falls keine Totals (sollte nicht passieren), auf erste dringende Kostenstelle buchen
        if(allocs.length === 0 && urgentIds.length){
          const o = (state.orders || []).find(x=>x.id===urgentIds[0]);
          const cc = o && o.costCenter ? String(o.costCenter) : "";
          if(cc) allocs = [{ costCenter: cc, amount: Number(shipFee.toFixed(2)) }];
        }
        closeModal();
        commitPlaced("urgent", shipFee, allocs);
      });

      return;
    }

    // Standardfall (MBW erreicht oder keine Versandkostenregel)
    commitPlaced("standard", 0, []);
  }

  function completeVendor(batch, vendor){
    if(!batch || !vendor) return;
    const g = batch.groups && batch.groups[vendor];
    if(!g) return;

    normalizeGroupShape(g);

    if(g.status !== "Bestellt") return;

    g.status = "Abgeschlossen";
    const now = nowIso();

    for(const id of (g.orderIds || [])){
      const o = state.orders.find(x=>x.id===id);
      if(!o) continue;

      const parts = splitParts(o);
      const p = parts.find(x=>x.vendor === vendor);
      if(p){
        p.status = "Abgeschlossen";
      }

      o.audit = o.audit || [];
      o.audit.push({ at: now, who: "Lieferung", what: `Geliefert: ${vendor}` });
      o.audit.push({ at: now, who: "System", what: `Abgeschlossen: ${vendor}` });

      syncAggregate(o);

      pushActivity({ text: `${o.id}: Teilbestellung ${vendor} abgeschlossen`, orderId: o.id, audience: ["user"] });
    }

    batch.groups[vendor] = g;
    state.ui.lastBatch = batch;
    saveState();

    renderIn();
    renderOut(batch);

    pushActivity({ text: `Abgeschlossen: ${vendor}`, audience: ["central","lead"] });
  }

  renderIn();
  renderOut(currentBatch());

  if(btn) btn.addEventListener("click", run);
}
