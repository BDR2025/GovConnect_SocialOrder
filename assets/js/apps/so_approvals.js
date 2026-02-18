/* social_order_v0.18.8 · apps/so_approvals (ESM)
   Social Order: "Freigaben" view.
   Extracted from app.js to keep the shell lean.
*/

import { orderTotal, orderItemCount } from "../domain/order.js";
import { orderDetailsHtml } from "./so_orders.js";

export function mountApprovals(ctx){
  const {
    state,
    permissions,
    saveState,
    openModal,
    closeModal,
    nowIso,
    pushActivity,
    escapeHtml,
    util,
    visibleOrdersForCurrentUser,
    orderOrgLabel,
    orderGateReason,
    orderInDept,
    orderInUnit,
    orderOwner,
    render
  } = ctx;

  const listEl = document.getElementById("approvals-list");
  const detailEl = document.getElementById("approvals-detail");
  if(!listEl) return;

  const caps = typeof permissions === 'function' ? permissions() : { canApprovals: false };
  if(!caps.canApprovals){
    listEl.innerHTML = `<div class="callout"><div class="callout__title">Keine Berechtigung</div><div class="callout__text">Diese Ansicht ist für die <strong>Freigabe</strong> (Fachbereich) gedacht.</div></div>`;
    if(detailEl) detailEl.innerHTML = "";
    return;
  }

  const canAct = Boolean(caps.approverDept);
  const scope = caps.approvalsScope || { deptId: "all", unitId: "all" };
  const scopeLabel = (scope.deptId && scope.deptId !== "all" && caps.user && caps.user.deptLabel)
    ? String(caps.user.deptLabel)
    : "Fachbereich";

  function inScope(order){
    if(!order) return false;
    if(scope.deptId && scope.deptId !== "all" && !orderInDept(order, scope.deptId)) return false;
    if(scope.unitId && scope.unitId !== "all" && !orderInUnit(order, scope.unitId)) return false;
    return true;
  }

  function approvals(){
    const base = visibleOrdersForCurrentUser(state.orders || []);
    return base
      .filter(o => String(o.status || "") === "In Freigabe")
      .filter(inScope)
      .slice()
      .sort((a,b)=> new Date(a.createdAt||0).getTime() - new Date(b.createdAt||0).getTime());
  }

  function ensureSelection(list){
    const cur = state.ui.approvalsSelectedId;
    if(cur && list.some(o => String(o.id) === String(cur))) return String(cur);
    const next = list.length ? String(list[0].id) : null;
    state.ui.approvalsSelectedId = next;
    saveState();
    return next;
  }

  function approve(order){
    if(!order) return;

    if(!canAct){
      openModal(`<div class="callout"><div class="callout__title">Nur Fachbereichsfreigabe</div><div class="callout__text">In dieser Demo können nur Fachbereichsleitungen (Freigabe) Entscheidungen treffen. Bitte Testperson wechseln.</div></div><div style="margin-top:10px;"><button class="btn btn--primary" data-close="1">OK</button></div>`);
      return;
    }

    const p = permissions();
    const who = p.user ? p.user.name : "Freigabe";
    order.status = "Freigegeben";
    order.audit = order.audit || [];
    order.audit.push({ at: nowIso(), who, what: "Freigegeben" });
    saveState();
    pushActivity({ text: `Freigegeben: ${order.id}`, orderId: order.id, audience: ["user"] });
    pushActivity({ text: `Freigegeben: ${order.id} bereit für Bestelllauf`, orderId: order.id, audience: ["central"] });
  }

  function reject(order){
    if(!order) return;

    if(!canAct){
      openModal(`<div class="callout"><div class="callout__title">Nur Fachbereichsfreigabe</div><div class="callout__text">In dieser Demo können nur Fachbereichsleitungen (Freigabe) Entscheidungen treffen. Bitte Testperson wechseln.</div></div><div style="margin-top:10px;"><button class="btn btn--primary" data-close="1">OK</button></div>`);
      return;
    }

    const p = permissions();
    const who = p.user ? p.user.name : "Freigabe";
    order.status = "Abgelehnt";
    order.audit = order.audit || [];
    order.audit.push({ at: nowIso(), who, what: "Abgelehnt" });
    saveState();
    pushActivity({ text: `Abgelehnt: ${order.id}`, orderId: order.id, audience: ["user"] });
    pushActivity({ text: `Abgelehnt: ${order.id} (Kontroll- und Governance-Fall)`, orderId: order.id, audience: ["lead"] });
  }

  function question(order){
    if(!order) return;
    const id = order.id;

    if(!canAct){
      openModal(`<div class="callout"><div class="callout__title">Nur Fachbereichsfreigabe</div><div class="callout__text">In dieser Demo können nur Fachbereichsleitungen (Freigabe) Rückfragen stellen. Bitte Testperson wechseln.</div></div><div style="margin-top:10px;"><button class="btn btn--primary" data-close="1">OK</button></div>`);
      return;
    }

    openModal(`
      <div class="callout callout--warn">
        <div class="callout__title">Rückfrage stellen</div>
        <div class="callout__text">Bitte kurz beschreiben, was noch fehlt. Die Anforderung wird in den Status <strong>„Rückfrage“</strong> gesetzt.</div>
      </div>

      <div style="margin-top:10px;">
        <label class="label" for="q-text">Kommentar</label>
        <textarea id="q-text" rows="4" placeholder="z.B. Bitte Montageort / Raum / Ansprechpartner ergänzen…"></textarea>
      </div>

      <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn btn--primary" id="btn-send-question">Senden</button>
        <button class="btn" data-close="1">Abbrechen</button>
      </div>
    `, { title: `Rückfrage · ${escapeHtml(id)}` });

    const btn = document.getElementById("btn-send-question");
    if(btn){
      btn.addEventListener("click", ()=>{
        const ta = document.getElementById("q-text");
        const txt = (ta ? ta.value : "").trim();
        if(!txt){
          openModal(`<div class="callout callout--warn"><div class="callout__title">Kommentar fehlt</div><div class="callout__text">Bitte einen kurzen Kommentar eingeben.</div></div><div style="margin-top:10px;"><button class="btn btn--primary" data-close="1">OK</button></div>`);
          return;
        }

        order.status = "Rückfrage";
        const p = permissions();
        const who = p.user ? p.user.name : "Freigabe";
        order.question = { at: nowIso(), by: who, text: txt };
        order.audit = order.audit || [];
        order.audit.push({ at: nowIso(), who, what: "Rückfrage gestellt" });
        saveState();

        pushActivity({ text: `Rückfrage zu ${id}: ${txt}`, orderId: id, audience: ["user"] });
        pushActivity({ text: `Rückfrage gestellt: ${id}`, orderId: id, audience: ["lead"] });
        closeModal();
        render();
      });
    }
  }

  function renderDetail(order){
    if(!detailEl) return;
    if(!order){
      detailEl.innerHTML = `<div class="cart__empty">Keine Auswahl.</div>`;
      return;
    }

    detailEl.innerHTML = `
      <div class="row row--space" style="gap:12px; flex-wrap:wrap; margin-bottom:10px;">
        <div style="min-width:0;">
          <div class="muted small">Prüfung · ${escapeHtml(scopeLabel)}</div>
          <div style="font-size:16px;"><strong>${escapeHtml(order.id)}</strong> · ${escapeHtml(orderOrgLabel(order))}</div>
        </div>
        <div class="row" style="gap:10px; flex-wrap:wrap;">
          <button class="btn btn--primary" type="button" data-ap-action="approve" ${canAct ? "" : "disabled"}>Freigeben</button>
          <button class="btn" type="button" data-ap-action="question" ${canAct ? "" : "disabled"}>Rückfrage</button>
          <button class="btn" type="button" data-ap-action="reject" ${canAct ? "" : "disabled"}>Ablehnen</button>
        </div>
      </div>

      ${orderDetailsHtml(ctx, order)}
    `;

    const btnApprove = detailEl.querySelector('[data-ap-action="approve"]');
    const btnQuestion = detailEl.querySelector('[data-ap-action="question"]');
    const btnReject = detailEl.querySelector('[data-ap-action="reject"]');

    if(btnApprove) btnApprove.addEventListener('click', ()=>{ approve(order); render(); });
    if(btnQuestion) btnQuestion.addEventListener('click', ()=> question(order));
    if(btnReject) btnReject.addEventListener('click', ()=>{ reject(order); render(); });
  }

  function doRender(){
    const list = approvals();
    if(!list.length){
      listEl.innerHTML = `<div class="callout"><div class="callout__title">Alles erledigt</div><div class="callout__text">Derzeit gibt es keine Anforderungen <strong>in Freigabe</strong> im eigenen Bereich.</div></div>`;
      if(detailEl) detailEl.innerHTML = `<div class="cart__empty">Keine Anforderungen zur Prüfung.</div>`;
      return;
    }

    const selId = ensureSelection(list);

    listEl.innerHTML = list.map(o=>{
      const total = orderTotal(o);
      const nItems = orderItemCount(o);
      const owner = orderOwner(o);
      const ownerTxt = owner ? owner.name : "–";
      const isSel = selId && String(o.id) === String(selId);
      return `
        <button type="button" class="item ${isSel ? 'item--selected' : ''}" data-select="${escapeHtml(o.id)}" style="width:100%; text-align:left; margin-bottom:10px;">
          <div style="min-width:0;">
            <div class="item__title">${escapeHtml(o.id)} · ${escapeHtml(orderOrgLabel(o))}</div>
            <div class="item__meta">${escapeHtml(util.dt(o.createdAt))} · ${nItems} Positionen · ${escapeHtml(util.eur(total))}</div>
            <div class="item__meta"><strong>Anforderer*in:</strong> ${escapeHtml(ownerTxt)} · <strong>Grund:</strong> ${escapeHtml(orderGateReason(o))}</div>
          </div>
        </button>
      `;
    }).join('');

    listEl.querySelectorAll('[data-select]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-select');
        state.ui.approvalsSelectedId = id;
        saveState();
        doRender();
      });
    });

    const selected = list.find(o => String(o.id) === String(selId)) || null;
    renderDetail(selected);
  }

  doRender();
}
