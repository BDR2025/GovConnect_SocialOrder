/* social_order_v0.19.0 · apps/so_new (ESM)
   Social Order: "Neue Anforderung" view.
   Extracted from app.js to keep the shell lean.
*/

import { computeGate } from "../domain/gate.js";
export function mountNewOrder(ctx){
  const {
    state,
    mock,
    util,
    escapeHtml,
    openModal,
    saveState,
    permissions,
    getCurrentUser,
    hasRoleKey,
    ORG_MODEL,
    ORG_BY_ID,
    COSTCENTER_BY_CODE,
    ALL_LOCATIONS,
    formatOrgUnit,
    pushActivity,
    nowIso
  } = ctx;

  const catalogEl = document.getElementById("catalog");
  const groupsEl = document.getElementById("catalog-groups");
  const catalogSearch = document.getElementById("catalog-search");

  const cartEl = document.getElementById("cart");
  const cartCountEl = document.getElementById("cart-count");
  const cartSupplierEl = document.getElementById("cart-supplier");
  const totalEl = document.getElementById("cart-total");
  const btnSubmit = document.getElementById("btn-submit-order");

  // Stammdatenfelder (Org / Kostenstelle / Lieferort / Zweck)
  const orgSelect = document.getElementById("f-org");
  const deptField = document.getElementById("f-dept");
  const costSelect = document.getElementById("f-cost");
  const locInput = document.getElementById("f-loc");
  const locList = document.getElementById("loc-list");
  const purposeInput = document.getElementById("f-purpose");

  const detailsException = document.getElementById("details-exception");
  const specialHint = document.getElementById("special-hint");
  const specialHintText = document.getElementById("special-hint-text");

  const cart = new Map(); // id -> {item, qty}

  // --- Org & Kostenstellen: select options + Auto-Fill ---
  function renderOrgOptions(){
    if(!orgSelect) return;
    const deps = ORG_MODEL && Array.isArray(ORG_MODEL.departments) ? ORG_MODEL.departments : [];
    if(!deps.length){
      orgSelect.innerHTML = `<option value="">–</option>`;
      return;
    }

    // Optgroups by Fachbereich
    orgSelect.innerHTML = deps.map(d=>{
      const units = Array.isArray(d.units) ? d.units : [];
      const opts = units.map(u=>{
        const uFull = ORG_BY_ID[u.id] || u;
        const label = formatOrgUnit(Object.assign({}, uFull, { deptId: d.id, deptName: d.name }));
        return `<option value="${escapeHtml(u.id)}">${escapeHtml(label)}</option>`;
      }).join("");
      return `<optgroup label="${escapeHtml(d.name)}">${opts}</optgroup>`;
    }).join("");

    // Restore last selection if available
    const saved = state.ui.newOrderOrgId;
    if(saved && ORG_BY_ID[saved]) orgSelect.value = saved;
  }

  function renderCostOptions(orgId){
    if(!costSelect) return;
    const u = ORG_BY_ID[orgId];
    const ccs = (u && Array.isArray(u.costCenters) && u.costCenters.length) ? u.costCenters : Object.values(COSTCENTER_BY_CODE);

    // Pflichtfeld: bewusst ohne Default, damit nichts versehentlich gesetzt wird.
    const opts = ccs.map(cc=> `<option value="${escapeHtml(cc.code)}">${escapeHtml(cc.code)} · ${escapeHtml(cc.name||"")}</option>`).join("");
    costSelect.innerHTML = `<option value="">Bitte auswählen…</option>` + opts;

    costSelect.value = "";
    state.ui.newOrderCostCenter = "";
  }

  function renderLocationOptions(orgId){
    if(!locList) return;
    const u = ORG_BY_ID[orgId];
    const locs = (u && Array.isArray(u.locations) && u.locations.length) ? u.locations : ALL_LOCATIONS;
    locList.innerHTML = locs.map(l=> `<option value="${escapeHtml(l)}"></option>`).join("");

    // Auto-fill: use saved or default per org
    if(locInput){
      const saved = state.ui.newOrderLocation;
      if(saved) locInput.value = saved;
      else if(!locInput.value && locs.length) locInput.value = locs[0];
    }
  }

  function applyOrgSelection(){
    if(!orgSelect) return;
    const orgId = orgSelect.value;
    const u = ORG_BY_ID[orgId];
    if(deptField) deptField.value = u && u.deptName ? u.deptName : "–";
    renderCostOptions(orgId);
    renderLocationOptions(orgId);
    state.ui.newOrderOrgId = orgId;
    saveState();
  }

  renderOrgOptions();
  if(orgSelect){
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const userUnitId = user && user.unitId ? String(user.unitId) : "";
    const isCentral = user && typeof hasRoleKey === 'function' ? hasRoleKey(user, "central") : false;

    // Im Livebetrieb: Org-Einheit kommt aus dem Benutzerprofil.
    // In der Demo: für Mitarbeitende ist die Org-Einheit fix (nicht änderbar).
    if(!isCentral && userUnitId && ORG_BY_ID[userUnitId]){
      orgSelect.value = userUnitId;
      orgSelect.disabled = true;
      orgSelect.classList.add("is-disabled");
    }else{
      // Zentral (oder ohne Profil): freie Auswahl möglich, Default = erste Option
      if(!orgSelect.value){
        const first = orgSelect.querySelector("option");
        if(first) orgSelect.value = first.value;
      }
      orgSelect.addEventListener("change", applyOrgSelection);
    }

    applyOrgSelection();
  }

  if(costSelect){
    costSelect.addEventListener("change", ()=>{
      state.ui.newOrderCostCenter = costSelect.value;
      saveState();
    });
  }

  if(locInput){
    locInput.addEventListener("input", ()=>{
      state.ui.newOrderLocation = locInput.value;
      saveState();
    });
  }

  if(purposeInput){
    // optional, but keep it for convenience when navigating around
    purposeInput.value = state.ui.newOrderPurpose || "";
    purposeInput.addEventListener("input", ()=>{
      state.ui.newOrderPurpose = purposeInput.value;
      saveState();
    });
  }

  const GROUPS = [
    { id: "desk", label: "Desk & Büro" },
    { id: "print", label: "Print & Copy" },
    { id: "board", label: "Pin- & Whiteboard" },
    { id: "kitchen", label: "Küche & Sanitär" }
  ];

  function groupLabel(id){
    const g = GROUPS.find(x => x.id === id);
    return g ? g.label : "Sonstiges";
  }

  let selectedGroup = state.ui.catalogGroup || "desk";
  let searchQ = state.ui.catalogSearch || "";

  if(catalogSearch) catalogSearch.value = searchQ;

  function setSearch(q){
    searchQ = q;
    state.ui.catalogSearch = q;
    saveState();
  }

  function setGroup(g){
    selectedGroup = g;
    state.ui.catalogGroup = g;
    saveState();
  }

  function filterCatalog(){
    const q = (searchQ || "").trim().toLowerCase();
    let list = state.catalog.slice();

    if(q){
      // Global search across all groups
      list = list.filter(it =>
        String(it.title || "").toLowerCase().includes(q) ||
        String(it.vendor || "").toLowerCase().includes(q) ||
        String(it.contract || "").toLowerCase().includes(q)
      );
    }else{
      list = list.filter(it => String(it.group || "desk") === selectedGroup);
    }

    return list;
  }

  function renderGroups(){
    if(!groupsEl) return;

    const q = (searchQ || "").trim();
    groupsEl.innerHTML = GROUPS.map(g => `
      <button type="button" class="chip ${(!q && g.id === selectedGroup) ? "chip--active" : ""}" data-group="${escapeHtml(g.id)}">
        ${escapeHtml(g.label)}
      </button>
    `).join("");

    groupsEl.querySelectorAll("[data-group]").forEach(btn => {
      btn.addEventListener("click", () => {
        const g = btn.getAttribute("data-group");
        setGroup(g);

        // Clicking a group exits search mode
        if(catalogSearch){
          catalogSearch.value = "";
        }
        setSearch("");

        renderGroups();
        renderCatalog();
      });
    });
  }

  function renderCatalog(){
    if(!catalogEl) return;

    const q = (searchQ || "").trim().toLowerCase();
    const list = filterCatalog();

    if(list.length === 0){
      catalogEl.innerHTML = `<div class="cart__empty">Keine Treffer.</div>`;
      return;
    }

    const hint = q ? `<div class="muted small" style="margin-bottom:8px;">Suche über alle Warengruppen (${list.length} Treffer)</div>` : "";

    const itemsHtml = list.map(it => {
      const metaParts = [];
      if(q) metaParts.push(groupLabel(String(it.group || "desk")));
      metaParts.push(String(it.vendor || "–"));
      if(it.contract) metaParts.push(String(it.contract));
      metaParts.push(String(it.unit || "–"));
      metaParts.push(util.eur(it.price));

      const specialTag = it.special ? `<span class="pill pill--warn">Sonderbedarf</span>` : "";

      return `
        <div class="item" data-id="${escapeHtml(it.id)}">
          <div>
            <div class="item__title">${escapeHtml(it.title)}</div>
            <div class="item__meta">${metaParts.map(escapeHtml).join(" · ")}</div>
          </div>
          <div class="item__right">
            ${specialTag}
            <button class="btn" data-add="${escapeHtml(it.id)}" title="Hinzufügen">+</button>
          </div>
        </div>
      `;
    }).join("");

    catalogEl.innerHTML = hint + itemsHtml;

    catalogEl.querySelectorAll("[data-add]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.getAttribute("data-add");
        addToCart(id);
      });
    });
  }

  function addToCart(id){
    const it = state.catalog.find(x=>x.id===id);
    if(!it) return;

    const existing = cart.get(id);
    const qty = existing ? existing.qty + 1 : 1;
    cart.set(id, { item: it, qty });
    renderCart();
  }

  function decCart(id){
    const e = cart.get(id);
    if(!e) return;
    if(e.qty <= 1){ cart.delete(id); }
    else { cart.set(id, { item: e.item, qty: e.qty - 1 }); }
    renderCart();
  }

  function incCart(id){
    const e = cart.get(id);
    if(!e) return addToCart(id);
    cart.set(id, { item: e.item, qty: e.qty + 1 });
    renderCart();
  }

  function removeCart(id){
    cart.delete(id);
    renderCart();
  }

  function updateSpecialUi(entries){
    const specials = entries.filter(e => e.item && e.item.special);

    if(specialHint){
      if(specials.length){
        specialHint.style.display = "block";
        const names = specials.map(s => s.item.title);
        specialHintText.textContent = (names.length === 1)
          ? `"${names[0]}" erfordert eine Begründung (Sonderbedarf).`
          : `Ausgewählte Artikel erfordern eine Begründung (Sonderbedarf): ${names.join(", ")}.`;
      }else{
        specialHint.style.display = "none";
      }
    }

    if(detailsException && specials.length){
      detailsException.open = true;
    }
  }

  function renderCart(){
    const entries = Array.from(cart.values());
    if(cartCountEl) cartCountEl.textContent = `${entries.reduce((s,e)=>s+e.qty,0)} Positionen`;

    // Lieferanten (Multi-Lieferanten-Warenkorb ist erlaubt)
    if(cartSupplierEl){
      if(entries.length === 0){
        cartSupplierEl.textContent = "Lieferanten: –";
      }else{
        const vs = Array.from(new Set(entries.map(e=>e.item && e.item.vendor).filter(Boolean)));
        const cs = Array.from(new Set(entries.map(e=>e.item && e.item.contract).filter(Boolean)));
        if(vs.length === 1){
          const c = cs.length === 1 ? cs[0] : "";
          cartSupplierEl.textContent = c ? `Lieferant: ${vs[0]} · ${c}` : `Lieferant: ${vs[0]}`;
        }else{
          const vList = (vs.length <= 2) ? vs.join(", ") : `${vs[0]}, ${vs[1]} + ${vs.length-2}`;
          cartSupplierEl.textContent = `Lieferanten: ${vList}`;
        }
      }
    }

    updateSpecialUi(entries);

    if(entries.length === 0){
      if(cartEl) cartEl.innerHTML = `<div class="cart__empty">Noch nichts im Warenkorb.</div>`;
      if(totalEl) totalEl.textContent = util.eur(0);
      return;
    }

    const total = entries.reduce((sum,e)=> sum + e.qty * Number(e.item.price), 0);
    if(totalEl) totalEl.textContent = util.eur(total);

    if(cartEl){
      cartEl.innerHTML = entries.map(e=>`
        <div class="cartRow" data-id="${escapeHtml(e.item.id)}">
          <div>
            <div class="cartRow__title">${escapeHtml(e.item.title)}</div>
            <div class="cartRow__meta">${escapeHtml(e.item.unit)} · ${escapeHtml(util.eur(e.item.price))} · ${escapeHtml(e.item.vendor)}${e.item.contract ? " · " + escapeHtml(e.item.contract) : ""}${e.item.special ? " · Sonderbedarf" : ""}</div>
          </div>
          <div class="cartRow__right">
            <div class="qty">
              <button type="button" data-dec="${escapeHtml(e.item.id)}" aria-label="Menge reduzieren">−</button>
              <div class="pill">${escapeHtml(e.qty)}</div>
              <button type="button" data-inc="${escapeHtml(e.item.id)}" aria-label="Menge erhöhen">+</button>
            </div>
            <button type="button" class="cartRow__remove" data-rem="${escapeHtml(e.item.id)}" aria-label="Entfernen">×</button>
          </div>
        </div>
      `).join("");

      cartEl.querySelectorAll("[data-dec]").forEach(b=> b.addEventListener("click", ()=> decCart(b.getAttribute("data-dec"))));
      cartEl.querySelectorAll("[data-inc]").forEach(b=> b.addEventListener("click", ()=> incCart(b.getAttribute("data-inc"))));
      cartEl.querySelectorAll("[data-rem]").forEach(b=> b.addEventListener("click", ()=> removeCart(b.getAttribute("data-rem"))));
    }
  }

  function nextOrderId(){
    const nums = state.orders
      .map(o=> String(o.id).match(/SO-(\d+)/))
      .filter(Boolean)
      .map(m=> Number(m[1]));
    const max = nums.length ? Math.max(...nums) : 1000;
    return `SO-${max+1}`;
  }

  function submit(){
    const entries = Array.from(cart.values());
    if(entries.length === 0){
      openModal(`<div class="callout"><div class="callout__title">Fehlt noch</div><div class="callout__text">Bitte mindestens einen Artikel hinzufügen.</div></div>`);
      return;
    }

    const orgId = (orgSelect ? orgSelect.value : document.getElementById("f-org").value);
    const orgUnit = ORG_BY_ID[orgId] || null;
    const org = orgUnit ? String(orgUnit.label) : String(orgId||"");

    const costCenter = (costSelect ? costSelect.value : document.getElementById("f-cost").value).trim();
    if(!costCenter){
      openModal(`
        <div class="callout callout--warn">
          <div class="callout__title">Kostenstelle fehlt</div>
          <div class="callout__text">Bitte wählen Sie eine Kostenstelle aus.</div>
        </div>
        <div style="margin-top:10px;">
          <button class="btn btn--primary" data-close="1">OK</button>
        </div>
      `);
      setTimeout(()=>{ if(costSelect) costSelect.focus(); }, 50);
      return;
    }
    const purpose = (purposeInput ? purposeInput.value : document.getElementById("f-purpose").value).trim();
    const location = (locInput ? locInput.value : document.getElementById("f-loc").value).trim();
    const urgency = document.getElementById("f-urgency").value;
    const exception = document.getElementById("f-exception").value.trim();

    // IMPORTANT: Gate-Regeln (Sonderbedarf) müssen die Artikelattribute sehen.
    // Deshalb werden die relevanten Signale explizit in die Item-Payload übernommen.
    const items = entries.map(e=>({
      id: e.item.id,
      title: e.item.title,
      unit: e.item.unit,
      qty: e.qty,
      price: e.item.price,
      vendor: e.item.vendor,
      vendorId: e.item.vendorId,
      contract: e.item.contract,
      contractId: e.item.contractId,
      contractKey: e.item.contractKey,
      // Sonderbedarf-Signal (legacy + vorbereitet)
      special: Boolean(e.item.special),
      isSonderbedarf: Boolean(e.item.isSonderbedarf),
      gatePolicy: e.item.gatePolicy
    }));

    const vendors = Array.from(new Set(items.map(it => it.vendor).filter(Boolean)));

    const gate = computeGate({
      items,
      exceptionText: exception,
      urgency,
      threshold: Number(mock.meta.gateThreshold || 25)
    });

    // Special items => justification mandatory (demo rule)
    if(gate.missingJustification){
      if(detailsException) detailsException.open = true;
      openModal(`
        <div class="callout callout--warn">
          <div class="callout__title">Begründung erforderlich</div>
          <div class="callout__text">Mindestens ein Artikel ist als <strong>Sonderbedarf</strong> markiert. Bitte begründen Sie den Bedarf.</div>
        </div>
        <div style="margin-top:10px;">
          <button class="btn btn--primary" data-close="1">Verstanden</button>
        </div>
      `);
      setTimeout(()=>{ const ta = document.getElementById("f-exception"); if(ta) ta.focus(); }, 50);
      return;
    }

    const needsGate = gate.needsGate;
    const status = gate.status;
    const gateReason = gate.gateReason;

    const id = nextOrderId();
    const now = typeof nowIso === 'function' ? nowIso() : new Date().toISOString();

    const p = typeof permissions === 'function' ? permissions() : { userId: null, user: null };
    const who = p.user ? p.user.name : "Mitarbeitende";
    const audit = [
      { at: now, who, what: "Anforderung erfasst" },
      ...(exception.length ? [{ at: now, who, what: "Sonderbedarf begründet" }] : []),
      { at: now, who: "System", what: needsGate ? `Gate im Amt: In Freigabe (${gateReason})` : "Standardfall: sofort freigegeben" }
    ];

    const order = {
      id,
      ownerId: p.userId,
      createdAt: now,
      org,
      orgId: orgId || undefined,
      costCenter,
      purpose: purpose || undefined,
      location,
      urgency,
      status,
      gateReason: gateReason || undefined,
      exceptionText: exception || undefined,
      items,
      audit
    };

    state.orders.unshift(order);
    // Convenience: purpose field should not "stick" between orders.
    state.ui.newOrderPurpose = "";
    saveState();

    // Feed entries (role-aware)
    if(typeof pushActivity === 'function'){
      pushActivity({ text: `Anforderung ${id} erfasst (Status: ${status})`, orderId: id, audience: ["user"] });
      if(needsGate){
        pushActivity({ text: `Neue Freigabe: ${id} (${gateReason})`, orderId: id, audience: ["approver"] });
      }else{
        pushActivity({ text: `Freigegeben: ${id} bereit für Bestelllauf`, orderId: id, audience: ["central"] });
      }
      pushActivity({ text: `Transparenz: ${id} im Audit-Trail nachvollziehbar`, orderId: id, audience: ["lead"] });
    }

    openModal(`
      <div class="callout">
        <div class="callout__title">Gesendet</div>
        <div class="callout__text">
          Anforderung <strong>${escapeHtml(id)}</strong> wurde erfasst.
          Status ist <strong>${escapeHtml(status)}</strong>${needsGate ? ` (<span class="muted">${escapeHtml(gateReason)}</span>)` : ""}.\n            ${vendors.length > 1 ? `<div class="muted small" style="margin-top:6px;">Hinweis: Enthält ${vendors.length} Lieferanten. Im Bestelllauf erfolgt automatisch eine Aufsplittung pro Lieferant.</div>` : ""}
        </div>
      </div>
      <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
        <a class="btn btn--primary" href="#/app/orders" data-close="1">Zu meinen Anforderungen</a>
        <a class="btn" href="#/app/new" data-close="1">Noch eine erfassen</a>
      </div>
    `);
  }

  // Events
  if(catalogSearch){
    catalogSearch.addEventListener("input", ()=>{
      setSearch(catalogSearch.value);
      renderGroups();
      renderCatalog();
    });
    catalogSearch.addEventListener("keydown", (e)=>{
      if(e.key === "Escape"){
        catalogSearch.value = "";
        setSearch("");
        renderGroups();
        renderCatalog();
      }
    });
  }

  renderGroups();
  renderCatalog();
  renderCart();

  if(btnSubmit) btnSubmit.addEventListener("click", submit);
}
