/* social_order_v0.19.0 · apps/so_orders (ESM)
   Social Order: "Meine Anforderungen" view + shared Order detail renderers.
   Extracted from app.js to keep the shell lean.
*/

import {
  orderTotal,
  orderItemCount,
  orderVendors,
  orderContracts,
  vendorsLabel,
  vendorsFullLabel,
  contractsFullLabel,
  splitParts,
  statusCategory
} from "../domain/order.js";

// Reusable block: Rückfragen (read + answer)
function renderQuestionBlock(ctx, order){
  const { escapeHtml, util, getCurrentUserId } = ctx;

  const q = order && order.question && order.question.text ? order.question : null;
  if(!q) return "";

  const answered = !!(order.answer && order.answer.text);

  const qHtml = `
    <div class="callout callout--warn" style="margin-top:10px;">
      <div class="callout__title">Rückfrage</div>
      <div class="callout__text">
        <div class="muted small">${escapeHtml(util.dt(q.at))} · ${escapeHtml(q.by || "Freigabe")}</div>
        <div style="margin-top:6px;"><strong>${escapeHtml(q.text)}</strong></div>
      </div>
    </div>
  `;

  if(answered){
    return qHtml + `
      <div class="callout" style="margin-top:10px;">
        <div class="callout__title">Ihre Antwort</div>
        <div class="callout__text">
          <div class="muted small">${escapeHtml(util.dt(order.answer.at))} · ${escapeHtml(order.answer.by || "Mitarbeitende")}</div>
          <div style="margin-top:6px;"><strong>${escapeHtml(order.answer.text)}</strong></div>
        </div>
      </div>
    `;
  }

  // Nur Anforderer*in kann Rückfragen beantworten (Demo-Logik)
  const cur = typeof getCurrentUserId === 'function' ? getCurrentUserId() : null;
  if(order.ownerId && cur && order.ownerId !== cur) return qHtml;

  return qHtml + `
    <div style="margin-top:10px;">
      <label class="label" for="answer-text">Antwort</label>
      <textarea id="answer-text" rows="3" placeholder="Kurze Antwort…"></textarea>
      <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn btn--primary" id="btn-answer-question">Antwort senden</button>
        <span class="muted small">Danach geht die Anforderung wieder in die Freigabe.</span>
      </div>
    </div>
  `;
}

// Inline-Details (wird u.a. in der Freigabe-Ansicht rechts verwendet)
export function orderDetailsHtml(ctx, order){
  const {
    escapeHtml,
    util,
    statusTag,
    orderOwnerLabel,
    orderCostCenterLabel,
    orderGateReason
  } = ctx;

  if(!order) return "";

  const owner = typeof orderOwnerLabel === 'function' ? orderOwnerLabel(order) : "–";
  const total = orderTotal(order);
  const vendorsTxt = vendorsFullLabel(order);
  const contractsTxt = contractsFullLabel(order);
  const gate = typeof orderGateReason === 'function' ? orderGateReason(order) : "Gate-Regel";

  // Sonderbedarf-Begründung (für Freigabe relevant)
  const exceptionTxt = (order && typeof order.exceptionText === "string") ? order.exceptionText.trim() : "";
  const hasSonderbedarf = Boolean(
    exceptionTxt ||
    String(order.gateReason || "").toLowerCase().includes("sonderbedarf") ||
    (Array.isArray(order.items) && order.items.some(it => it && (it.special || it.isSonderbedarf)))
  );
  const exceptionRow = hasSonderbedarf
    ? `<div class="kv__k">Begründung (Sonderbedarf)</div><div style="white-space:pre-wrap;">${escapeHtml(exceptionTxt || "–")}</div>`
    : "";

  const poBlock = (order.poNumbers && order.poNumbers.length)
    ? `<div class="callout" style="margin-top:10px;"><div class="callout__title">Bestellungen</div><div class="callout__text">${order.poNumbers.map(p=> `<span class="pill">${escapeHtml(p)}</span>`).join(" ")}</div></div>`
    : "";

  const questionBlock = renderQuestionBlock(ctx, order);

  // Teilbestellungen (Bestelllauf kann splitten)
  const parts = splitParts(order);
  const partsHtml = parts.length ? `
    <h2 class="h2">Teilbestellungen</h2>
    ${parts.map(p=>{
      const s = statusTag(p.status || "Im Bestelllauf");
      return `
        <div class="item" style="margin-bottom:10px;">
          <div style="min-width:0;">
            <div class="item__title">${escapeHtml(p.vendor || "–")} ${s}</div>
            <div class="item__meta">${escapeHtml(p.contract || "Ohne Vertrag")} · ${p.orderIds ? p.orderIds.length : 1} Anforderungen · ${escapeHtml(util.eur(Number(p.total||0)))}</div>
          </div>
          <div class="item__right">
            ${p.poNumber ? `<span class="pill">${escapeHtml(p.poNumber)}</span>` : ""}
          </div>
        </div>
      `;
    }).join("")}
  ` : "";

  // Positionen
  const itemsRows = (order.items||[]).map(it=>`
    <tr>
      <td>${escapeHtml(it.title)}</td>
      <td style="text-align:right;">${escapeHtml(it.qty)}</td>
      <td>${escapeHtml(it.unit||"–")}</td>
      <td style="text-align:right;">${escapeHtml(util.eur(it.price||0))}</td>
      <td style="text-align:right;">${escapeHtml(util.eur(Number(it.qty||0) * Number(it.price||0)))}</td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="muted">Keine Positionen.</td></tr>`;

  const itemsHtml = `
    <h2 class="h2">Positionen</h2>
    <table class="table">
      <thead>
        <tr>
          <th>Artikel</th>
          <th style="text-align:right;">Menge</th>
          <th>Einheit</th>
          <th style="text-align:right;">EP</th>
          <th style="text-align:right;">Gesamt</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="4" style="text-align:right;"><strong>Summe</strong></td>
          <td style="text-align:right;"><strong>${escapeHtml(util.eur(total))}</strong></td>
        </tr>
      </tfoot>
    </table>
  `;

  const audit = Array.isArray(order.audit) ? order.audit : [];
  const auditHtml = audit.length
    ? `
      <details class="details" style="margin-top:10px;">
        <summary>Audit-Trail (${audit.length})</summary>
        <div class="audit">
          ${audit.slice().reverse().map(a=>`
            <div class="audit__item">
              <div><strong>${escapeHtml(a.who || "–")}</strong> · ${escapeHtml(a.what || "")}</div>
              <div class="audit__time">${escapeHtml(util.dt(a.at))}</div>
            </div>
          `).join("")}
        </div>
      </details>
    `
    : "";

  return `
    <div class="kv" style="margin-top:6px;">
      <div class="kv__k">Anforderer</div><div>${escapeHtml(owner)}</div>
      <div class="kv__k">Kostenstelle</div><div>${escapeHtml(orderCostCenterLabel(order))}</div>
      <div class="kv__k">Lieferort</div><div>${escapeHtml(order.location || "–")}</div>
      <div class="kv__k">Verwendungszweck</div><div>${escapeHtml(order.purpose || "–")}</div>
      ${exceptionRow}
      <div class="kv__k">Lieferanten</div><div>${escapeHtml(vendorsTxt || "–")}</div>
      <div class="kv__k">Rahmenverträge</div><div>${escapeHtml(contractsTxt || "–")}</div>
      <div class="kv__k">Grund (Gate)</div><div>${escapeHtml(gate || "–")}</div>
      <div class="kv__k">Status</div><div>${statusTag(order.status || "–")}</div>
    </div>
    ${poBlock}
    ${questionBlock}
    ${partsHtml}
    ${itemsHtml}
    ${auditHtml}
  `;
}

export function openOrderDetails(ctx, order){
  const {
    escapeHtml,
    util,
    openModal,
    closeModal,
    permissions,
    nowIso,
    saveState,
    pushActivity,
    navTo,
    ownerLabelById,
    orderGateReason,
    orderOrgLabel,
    orderDeptLabel,
    orderCostCenterLabel,
    statusTag,
    orderOwnerLabel
  } = ctx;

  if(!order) return;

  const exceptionTxt = (order && typeof order.exceptionText === "string") ? order.exceptionText.trim() : "";
  const hasSonderbedarf = Boolean(
    exceptionTxt ||
    String(order.gateReason || "").toLowerCase().includes("sonderbedarf") ||
    (Array.isArray(order.items) && order.items.some(it => it && (it.special || it.isSonderbedarf)))
  );
  const exceptionRow = hasSonderbedarf
    ? `<div class="kv__k">Begründung (Sonderbedarf)</div><div style="white-space:pre-wrap;">${escapeHtml(exceptionTxt || "–")}</div>`
    : "";

  const total = orderTotal(order);
  const nItems = orderItemCount(order);

  const vendors = orderVendors(order);
  const contracts = orderContracts(order);
  const parts = splitParts(order);

  const itemsHtml = `
    <div class="tableWrap" style="margin-top:10px;">
      <table class="table" style="min-width: 520px;">
        <thead>
          <tr><th>Artikel</th><th>Qty</th><th class="right">Preis</th><th class="right">Summe</th></tr>
        </thead>
        <tbody>
          ${(order.items||[]).map(it=>`
            <tr>
              <td><strong>${escapeHtml(it.title)}</strong><div class="muted small">${escapeHtml(it.vendor)}${it.contract ? " · " + escapeHtml(it.contract) : ""} · ${escapeHtml(it.unit)}</div></td>
              <td>${escapeHtml(it.qty)}</td>
              <td class="right">${escapeHtml(util.eur(it.price))}</td>
              <td class="right"><strong>${escapeHtml(util.eur(Number(it.price)*Number(it.qty)))}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  const auditHtml = `
    <div class="audit">
      ${(order.audit||[]).slice().reverse().map(a=>`
        <div class="audit__item">
          <div><strong>${escapeHtml(a.what)}</strong></div>
          <div class="audit__time">${escapeHtml(util.dt(a.at))} · ${escapeHtml(a.who)}</div>
        </div>
      `).join("")}
    </div>
  `;

  const questionBlock = renderQuestionBlock(ctx, order);

  const poNumbers = parts.length ? parts.map(p=>p.poNumber).filter(Boolean) : (order.poNumbers || []);
  const poBlock = poNumbers.length
    ? `<div class="callout" style="margin-top:10px;"><div class="callout__title">Bestellnummern</div><div class="callout__text"><strong>${escapeHtml(poNumbers.join(", "))}</strong></div></div>`
    : "";

  const partsHtml = parts.length ? `
    <h2 class="h2" style="margin-top:14px;">Teilbestellungen</h2>
    <div class="tableWrap" style="margin-top:10px;">
      <table class="table" style="min-width: 520px;">
        <thead>
          <tr><th>Lieferant</th><th>Status</th><th>PO</th><th class="right">Summe</th></tr>
        </thead>
        <tbody>
          ${parts.map(p=>`
            <tr>
              <td><strong>${escapeHtml(p.vendor||"–")}</strong><div class="muted small">${escapeHtml(p.contract||"")}</div></td>
              <td>${statusTag(p.status||"–")}</td>
              <td>${escapeHtml(p.poNumber||"–")}</td>
              <td class="right"><strong>${escapeHtml(util.eur(Number(p.total||0)))}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : "";

  openModal(`
    <div class="kv">
      <div class="kv__k">ID</div><div><strong>${escapeHtml(order.id)}</strong></div>
      <div class="kv__k">Status</div><div>${escapeHtml(order.status)}</div>
      <div class="kv__k">Anforderer</div><div>${escapeHtml(ownerLabelById(order.ownerId))}</div>
      <div class="kv__k">Gate-Grund</div><div>${escapeHtml(orderGateReason(order))}</div>
      <div class="kv__k">Lieferanten</div><div><strong>${escapeHtml(vendorsFullLabel(order))}</strong></div>
      <div class="kv__k">Rahmenverträge</div><div>${escapeHtml(contracts.length ? contracts.join(", ") : "–")}</div>
      <div class="kv__k">Organisation</div><div>${escapeHtml(orderOrgLabel(order))}</div>
      <div class="kv__k">Fachbereich</div><div>${escapeHtml(orderDeptLabel(order))}</div>
      <div class="kv__k">Kostenstelle</div><div>${escapeHtml(orderCostCenterLabel(order))}</div>
      <div class="kv__k">Verwendungszweck</div><div>${escapeHtml(order.purpose||"–")}</div>
      ${exceptionRow}
      <div class="kv__k">Lieferort</div><div>${escapeHtml(order.location||"–")}</div>
      <div class="kv__k">Positionen</div><div>${escapeHtml(nItems)}</div>
      <div class="kv__k">Summe</div><div><strong>${escapeHtml(util.eur(total))}</strong></div>
    </div>

    ${poBlock}
    ${questionBlock}
    ${partsHtml}
    ${itemsHtml}

    <h2 class="h2">Audit-Trail</h2>
    ${auditHtml}
  `, { title: "Details", context: { type: "order", orderId: order.id } });

  // bind answer action if present
  const btn = document.getElementById("btn-answer-question");
  if(btn){
    btn.addEventListener("click", ()=>{
      const ta = document.getElementById("answer-text");
      const txt = (ta ? ta.value : "").trim();
      if(!txt){
        openModal(`<div class="callout callout--warn"><div class="callout__title">Antwort fehlt</div><div class="callout__text">Bitte kurz antworten, damit die Freigabe weitergehen kann.</div></div><div style="margin-top:10px;"><button class="btn btn--primary" data-close="1">OK</button></div>`);
        return;
      }
      // Update order
      const p = typeof permissions === 'function' ? permissions() : { user: null };
      const by = p.user ? p.user.name : "Mitarbeitende";
      order.answer = { at: (typeof nowIso === 'function' ? nowIso() : new Date().toISOString()), by, text: txt };
      order.status = "In Freigabe";
      order.audit = order.audit || [];
      order.audit.push({ at: (typeof nowIso === 'function' ? nowIso() : new Date().toISOString()), who: by, what: "Rückfrage beantwortet" });
      saveState();

      if(typeof pushActivity === 'function'){
        pushActivity({ text: `Antwort auf Rückfrage zu ${order.id} eingegangen`, orderId: order.id, audience: ["approver"] });
        pushActivity({ text: `${order.id} wieder in Freigabe`, orderId: order.id, audience: ["user"] });
      }

      closeModal();
      if(typeof navTo === 'function') navTo("/app/orders");
    });
  }
}

export function buildPrintOrderHtml(ctx, order){
  const { escapeHtml, util, orderGateReason, orderOrgLabel, orderDeptLabel, orderCostCenterLabel } = ctx;

  const total = orderTotal(order);
  const nItems = orderItemCount(order);

  const vendors = orderVendors(order);
  const contracts = orderContracts(order);
  const parts = splitParts(order);

  const poNumbers = parts.length ? parts.map(p=>p.poNumber).filter(Boolean) : (order.poNumbers || []);
  const created = order.createdAt ? util.dt(order.createdAt) : "–";
  const exported = util.dt(new Date().toISOString());

  const exceptionTxt = (order && typeof order.exceptionText === "string") ? order.exceptionText.trim() : "";
  const hasSonderbedarf = Boolean(
    exceptionTxt ||
    String(order.gateReason || "").toLowerCase().includes("sonderbedarf") ||
    (Array.isArray(order.items) && order.items.some(it => it && (it.special || it.isSonderbedarf)))
  );

  const grid = `
    <div class="printGrid">
      <div class="k">ID</div><div><strong>${escapeHtml(order.id)}</strong></div>
      <div class="k">Status</div><div>${escapeHtml(order.status||"–")}</div>
      <div class="k">Gate-Grund</div><div>${escapeHtml(orderGateReason(order))}</div>
      <div class="k">Organisation</div><div>${escapeHtml(orderOrgLabel(order))}</div>
      <div class="k">Fachbereich</div><div>${escapeHtml(orderDeptLabel(order))}</div>
      <div class="k">Kostenstelle</div><div>${escapeHtml(orderCostCenterLabel(order))}</div>
      <div class="k">Verwendungszweck</div><div>${escapeHtml(order.purpose||"–")}</div>
      ${hasSonderbedarf ? `<div class="k">Begründung (Sonderbedarf)</div><div style="white-space:pre-wrap;">${escapeHtml(exceptionTxt || "–")}</div>` : ""}
      <div class="k">Lieferort</div><div>${escapeHtml(order.location||"–")}</div>
      <div class="k">Lieferanten</div><div>${escapeHtml(vendorsFullLabel(order))}</div>
      <div class="k">Rahmenverträge</div><div>${escapeHtml(contracts.length ? contracts.join(", ") : "–")}</div>
      <div class="k">Positionen</div><div>${escapeHtml(String(nItems))}</div>
      <div class="k">Summe</div><div><strong>${escapeHtml(util.eur(total))}</strong></div>
      ${poNumbers.length ? `<div class="k">Bestellnummern</div><div>${escapeHtml(poNumbers.join(", "))}</div>` : ""}
    </div>
  `;

  const itemsRows = (order.items||[]).map(it=>{
    const sum = Number(it.price) * Number(it.qty||0);
    return `
      <tr>
        <td><strong>${escapeHtml(it.title)}</strong><div class="printMeta">${escapeHtml(it.vendor||"–")}${it.contract ? " · " + escapeHtml(it.contract) : ""} · ${escapeHtml(it.unit||"")}</div></td>
        <td class="right">${escapeHtml(String(it.qty||0))}</td>
        <td class="right">${escapeHtml(util.eur(Number(it.price||0)))}</td>
        <td class="right"><strong>${escapeHtml(util.eur(sum))}</strong></td>
      </tr>
    `;
  }).join("");

  const itemsTable = `
    <div class="printSection">
      <h2>Artikel</h2>
      <table class="printTable">
        <thead><tr><th>Artikel</th><th class="right">Qty</th><th class="right">Preis</th><th class="right">Summe</th></tr></thead>
        <tbody>${itemsRows || `<tr><td colspan="4">–</td></tr>`}</tbody>
      </table>
    </div>
  `;

  const partsTable = parts.length ? `
    <div class="printSection">
      <h2>Teilbestellungen</h2>
      <table class="printTable">
        <thead><tr><th>Lieferant</th><th>Status</th><th>PO</th><th class="right">Summe</th></tr></thead>
        <tbody>
          ${parts.map(p=>`
            <tr>
              <td><strong>${escapeHtml(p.vendor||"–")}</strong><div class="printMeta">${escapeHtml(p.contract||"")}</div></td>
              <td>${escapeHtml(p.status||"–")}</td>
              <td>${escapeHtml(p.poNumber||"–")}</td>
              <td class="right"><strong>${escapeHtml(util.eur(Number(p.total||0)))}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : "";

  const auditRows = (order.audit||[]).slice().reverse().map(a=>`
    <tr>
      <td>${escapeHtml(util.dt(a.at))}</td>
      <td>${escapeHtml(a.who||"–")}</td>
      <td>${escapeHtml(a.what||"–")}</td>
    </tr>
  `).join("");

  const auditTable = `
    <div class="printSection">
      <h2>Audit-Trail</h2>
      <table class="printTable">
        <thead><tr><th>Zeit</th><th>Wer</th><th>Ereignis</th></tr></thead>
        <tbody>${auditRows || `<tr><td colspan="3">–</td></tr>`}</tbody>
      </table>
    </div>
  `;

  return `
    <div class="printPage">
      <div class="printHeader">
        <div>
          <h1 class="printTitle">Anforderung ${escapeHtml(order.id)}</h1>
          <div class="printMeta">Erfasst: ${escapeHtml(created)} · Export: ${escapeHtml(exported)}</div>
        </div>
      </div>

      ${grid}
      ${partsTable}
      ${itemsTable}
      ${auditTable}

      <div class="printMeta" style="margin-top:14px;">Hinweis: Druckansicht aus der Demo (Social Order). Ausdruck kann im Browser als PDF gespeichert werden.</div>
    </div>
  `;
}

export function mountOrders(ctx){
  const { state, escapeHtml, util, saveState, visibleOrdersForCurrentUser, ownerNameById, orderOrgLabel, orderDeptLabel, orderCostCenterLabel, navTo } = ctx;

  const tbody = document.querySelector("#orders-table tbody");
  const foot = document.getElementById("orders-footnote");
  const search = document.getElementById("orders-search");

  const chips = Array.from(document.querySelectorAll("[data-filter]"));
  chips.forEach(c=>{
    c.classList.toggle("chip--active", c.getAttribute("data-filter") === state.ui.ordersFilter);
    c.addEventListener("click", ()=>{
      const f = c.getAttribute("data-filter");
      state.ui.ordersFilter = f;
      saveState();
      chips.forEach(x=> x.classList.toggle("chip--active", x.getAttribute("data-filter") === f));
      renderTable();
    });
  });

  if(search){
    search.value = state.ui.ordersSearch || "";
    search.addEventListener("input", ()=>{
      state.ui.ordersSearch = search.value;
      saveState();
      renderTable();
    });
  }

  function matchFilter(order){
    const cat = statusCategory(order.status);
    if(state.ui.ordersFilter === "all") return true;
    if(state.ui.ordersFilter === "open") return cat === "open";
    if(state.ui.ordersFilter === "approval") return cat === "approval" && order.status !== "Rückfrage";
    if(state.ui.ordersFilter === "question") return order.status === "Rückfrage";
    if(state.ui.ordersFilter === "done") return cat === "done";
    return true;
  }

  function matchSearch(order){
    const q = (state.ui.ordersSearch || "").trim().toLowerCase();
    if(!q) return true;
    return (
      String(order.id).toLowerCase().includes(q) ||
      orderOrgLabel(order).toLowerCase().includes(q) ||
      orderDeptLabel(order).toLowerCase().includes(q) ||
      orderCostCenterLabel(order).toLowerCase().includes(q) ||
      String(order.purpose||"").toLowerCase().includes(q) ||
      String(order.status||"").toLowerCase().includes(q) ||
      vendorsFullLabel(order).toLowerCase().includes(q) ||
      String(orderContracts(order).join(", ")).toLowerCase().includes(q)
    );
  }

  function statusChip(status){
    const cat = statusCategory(status);
    const cls =
      (status === "Rückfrage") ? "status status--question"
      : (cat === "approval") ? "status status--approval"
      : (cat === "done") ? (status === "Abgelehnt" ? "status status--rejected" : "status status--done")
      : "status status--open";
    return `<span class="${cls}">${escapeHtml(status)}</span>`;
  }

  function renderTable(){
    // "Meine Anforderungen" bleibt als Begriff konsistent auf allen Ebenen.
    // Sichtbarkeit richtet sich nach Persona/Scope.
    const base = visibleOrdersForCurrentUser(state.orders || []);
    const rows = base.filter(o => matchFilter(o) && matchSearch(o));
    tbody.innerHTML = rows.map(o=>{
      const total = orderTotal(o);
      const nItems = orderItemCount(o);
      return `
        <tr data-id="${escapeHtml(o.id)}" class="rowlink" tabindex="0" role="button">
          <td><strong>${escapeHtml(o.id)}</strong></td>
          <td>${escapeHtml(util.dt(o.createdAt))}</td>
          <td>${statusChip(o.status)}</td>
          <td>${escapeHtml(ownerNameById(o.ownerId))}</td>
          <td><strong>${escapeHtml(vendorsLabel(o))}</strong><div class="muted small">${escapeHtml(orderVendors(o).length === 1 ? (orderContracts(o)[0] || "") : vendorsFullLabel(o))}</div></td>
          <td>${nItems}</td>
          <td class="right"><strong>${escapeHtml(util.eur(total))}</strong></td>
        </tr>
      `;
    }).join("");

    if(foot){
      foot.textContent = rows.length === 1 ? "1 Treffer" : `${rows.length} Treffer`;
    }

    // Klick auf eine Zeile öffnet Details (robust via Event-Delegation)
    if(!tbody.dataset.bound){
      tbody.dataset.bound = "1";

      const openById = (id) => {
        if(!id) return;
        const order = (state.orders || []).find(o => String(o.id) === String(id));
        if(order) openOrderDetails(ctx, order);
      };

      tbody.addEventListener("click", (ev) => {
        const tr = ev.target.closest("tr[data-id]");
        if(!tr) return;
        openById(tr.getAttribute("data-id"));
      });

      tbody.addEventListener("keydown", (ev) => {
        if(ev.key !== "Enter" && ev.key !== " ") return;
        const tr = ev.target.closest("tr[data-id]");
        if(!tr) return;
        ev.preventDefault();
        openById(tr.getAttribute("data-id"));
      });
    }

    // Open order once (from activities / chronik links)
    if(state.ui.openOrderIdOnce){
      const id = state.ui.openOrderIdOnce;
      const order = base.find(o=>o.id===id);
      state.ui.openOrderIdOnce = null;
      saveState();
      if(order) openOrderDetails(ctx, order);
    }
  }

  renderTable();
}
