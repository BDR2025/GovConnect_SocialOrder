/* social_order_v0.19.2 · GovConnect Shell + Social Order Demo
   Features: Multi-Lieferanten-Warenkorb + automatische Aufsplittung im Bestelllauf (pro Lieferant) + Teilstatus
   v0.12: Exempla-Orga (Fachbereiche/Ämter) + Kostenstellen mit Klarname + Verwendungszweck/Bestellgrund
   v0.13: Dashboard: Tabs "Steuerung"/"Lagebild" + Filter (Fachbereich/Amt) + Mix-Umschaltung (Lieferant/Rahmenvertrag, Wert/Anzahl) + Trend als Balken
   v0.13.1: Org-/History-Migration: Filter funktioniert auch bei geladenen Altständen (legacy Demo-State)
   v0.14: Dashboard Tab "Analyse" (Top Ämter & Top Kostenstellen) + Umschaltung Bestellwert/Anzahl POs
   v0.15: Analyse-Drilldown (Klick auf Balken → Top POs, Öffnen der Detailansicht)
   v0.15.1: KPI-Logik geglättet (Anforderungen/POs konsistent) + Split-Quote
   v0.15.2: Drilldown-Modal poliert (klarere Labels + Tabelle passt in Modal)
   v0.15.3: Filter-UX finalisiert (Filterstatus überall sichtbar, Preset→Custom ohne Überraschung, Fokus bei „Filter ändern“)
   (keine externen Abhängigkeiten) */

import { MOCK } from "./mock-data.js";
import { PERSONNEL as PERSONNEL_DATA } from "./personnel.js";
import { CONTRACTS } from "./contracts.js";
import { escapeHtml, eur, dt } from "./core/utils.js";
import { createModal } from "./core/modal.js";
import { createStore } from "./core/store.js";
import { mountBatch as mountBatchImpl } from "./apps/so_batch.js";
import { mountDashboard as mountDashboardImpl } from "./apps/so_dashboard.js";
import { mountNewOrder as mountNewOrderImpl } from "./apps/so_new.js";
import { mountOrders as mountOrdersImpl, openOrderDetails as openOrderDetailsImpl, buildPrintOrderHtml as buildPrintOrderHtmlImpl } from "./apps/so_orders.js";
import { mountApprovals as mountApprovalsImpl } from "./apps/so_approvals.js";
import { mountDocuments as mountDocumentsImpl } from "./apps/doc_documents.js";
import { mountPeople as mountPeopleImpl } from "./apps/peo_people.js";

import { orderTotal, orderVendors, orderVendor, splitParts, syncAggregate, statusCategory, orderGateReason } from "./domain/order.js";

import { createSession } from "./core/context.js";
import { createPermissionsApi } from "./core/permissions.js";
import { createHashRouter } from "./core/router.js";

(function(){
  // NOTE: formatting helpers come from core/utils (eur/dt).
  const mock = MOCK;

  const VERSION = "0.19.2";
  const PERSONNEL = PERSONNEL_DATA;
  const PEOPLE = PERSONNEL && Array.isArray(PERSONNEL.people) ? PERSONNEL.people : [];
  const LEADERSHIP = PERSONNEL && PERSONNEL.leadership ? PERSONNEL.leadership : {};


  const els = {
    content: document.getElementById("app-content"),
    orgSwitch: document.getElementById("org-switch"),
    modal: document.getElementById("modal"),
    modalTitle: document.getElementById("modal-title"),
    modalBody: document.getElementById("modal-body"),
    modalPrint: document.getElementById("modal-print"),
    printRoot: document.getElementById("print-root"),
    modalClose: document.getElementById("modal-close"),
    activityBtn: document.getElementById("btn-activity"),
    activityBadge: document.getElementById("activity-badge"),
    profileBtn: document.getElementById("btn-profile"),
    burger: document.getElementById("btn-burger"),
    sidebar: document.getElementById("sidebar"),
    globalSearch: document.getElementById("global-search"),
    themeBtn: document.getElementById("btn-theme")
  };

  // Modal API (core/modal)
  const { openModal, closeModal, getModalContext, clearPrintRoot } = createModal(els);

  // Theme (Light/Dark)
  const THEME_KEY = "social_order_theme";

  // GovConnect shell (Demo): organisation/context switch
  const ORG_CONTEXTS = {
    city: { name: "Kreisstadt Exempla", sub: "Stadtverwaltung" },
    county: { name: "Landkreis Region Exempla", sub: "Kreisverwaltung" },
    state: { name: "Landesnetz Verwaltung", sub: "Interkommunal & Land" },
  };

  const state = {
    // v0.16.0: Rollen werden an Personen gebunden (siehe assets/js/personnel.js)
    // und über die Session-Persona ausgewählt.
    session: { userId: "p_br" },
    orders: [],
    historyOrders: [],
    catalog: [],
    activities: [],
    ui: {
      // GovConnect shell (Demo) – active organisation context
      orgContext: "city", // city | county | state
      ordersFilter: "all",
      ordersSearch: "",
      catalogGroup: "desk",
      catalogSearch: "",
      newOrderOrgId: "",
      newOrderCostCenter: "",
      newOrderLocation: "",
      newOrderPurpose: "",
      dashboardTab: "now",
      dashboardPreset: "30",
      dashboardFrom: "",
      dashboardTo: "",
      dashboardDept: "all",        // Fachbereich-Filter (id) oder "all"
      dashboardUnit: "all",        // Amt-Filter (id) oder "all"
      dashboardMixDim: "vendor",   // vendor | contract
      dashboardMixMetric: "value", // value | count
      dashboardAnaMetric: "value", // Analyse: value | count
      approvalsSelectedId: null,
      // Aktivitätsfeed: v0.16.0 pro Nutzer
      activitySeenAtByUser: {},
      // Legacy (ältere Stände): role-basiert
      activitySeenAt: {},
      lastBatch: null,     // { at, orderIds:[], groups:{vendor:{ids,total,count,poNumber?}}, orderCount }
      schemaVersion: 16.0, // interne Daten-/UI-Version (für Migrationslogik)
      poSeq: 2001          // simple counter for PO numbers
    }
  };
  function deepClone(x){ return JSON.parse(JSON.stringify(x)); }
  function nowIso(){ return new Date().toISOString(); }

  // ---------- Session / Personal (core/context) ----------
  const { ensureSession, getCurrentUserId, currentUserId, getPersonById, getCurrentUser } = createSession({
    state,
    people: PEOPLE,
    leadership: LEADERSHIP
  });

  // ---------- Shared: find orders across live + history ----------
  function findOrderById(id){
    if(!id) return null;
    const live = (state.orders || []).find(o => o && o.id === id);
    if(live) return live;
    const hist = (state.historyOrders || []).find(o => o && o.id === id);
    return hist || null;
  }

  // ---------- Store (core/store) ----------
  const store = createStore({
    version: VERSION,
    state,
    mock,
    deepClone,
    ensureSession,
    people: PEOPLE
  });
  const { STORAGE_KEY, STORAGE_KEYS_FALLBACK, loadState, saveState, resetDemo, initData: initDataCore } = store;

  function initData(){
    initDataCore();

    // v0.13.1: Repair/Migration for org-based filtering (Fachbereich/Amt)
    repairOrgDataIfNeeded();

    ensureOrderOwners();
    updateProfileButton();

    // Ensure aggregate status for split orders after reload
    state.orders.forEach(o => syncAggregate(o));
    (state.historyOrders || []).forEach(o => syncAggregate(o));

    // One-time welcome ping so the notification badge is visible in the demo
    if(!state.ui.welcomeShown){
      state.ui.welcomeShown = true;
      pushActivity({ text: "Willkommen! Diese Demo zeigt einen Bestellprozess im Social-Intranet-Rahmen (Mock-Daten).", audience: ["all"] });
    }
  }


  // Theme (Light/Dark)

  function sanitizeTheme(t){ return (t === "dark") ? "dark" : "light"; }

  function loadTheme(){
    try{
      return sanitizeTheme(localStorage.getItem(THEME_KEY) || document.documentElement.getAttribute("data-theme") || "light");
    }catch(_){
      return sanitizeTheme(document.documentElement.getAttribute("data-theme") || "light");
    }
  }

  function saveTheme(t){
    try{ localStorage.setItem(THEME_KEY, sanitizeTheme(t)); }catch(_){}
  }

  function applyTheme(t){
    const theme = sanitizeTheme(t);
    document.documentElement.setAttribute("data-theme", theme);

    // Update button label (nur Text, keine Symbole)
    if(els.themeBtn){
      const mode = theme === "dark" ? "Dunkel" : "Hell";
      const label = `Modus: ${mode}. Klicken zum Umschalten.`;
      els.themeBtn.setAttribute("aria-label", label);
      els.themeBtn.setAttribute("title", label);

      const tEl = document.getElementById("theme-switch-text");
      if(tEl) tEl.textContent = mode;
    }
  }

  function toggleTheme(){
    const current = sanitizeTheme(document.documentElement.getAttribute("data-theme") || "light");
    const next = (current === "dark") ? "light" : "dark";
    applyTheme(next);
    saveTheme(next);
  }

  function ownerNameById(ownerId){
    const p = ownerId ? getPersonById(ownerId) : null;
    return p ? p.name : "—";
  }

  function ownerLabelById(ownerId){
    const p = ownerId ? getPersonById(ownerId) : null;
    if(!p) return "—";
    const unit = p.unitId ? (ORG_UNIT_BY_ID[p.unitId]?.label || p.unitLabel || p.unitId) : null;
    return unit ? `${p.name} · ${unit}` : p.name;
  }

  // Backwards-compat helper used by detail renderers
  function orderOwnerLabel(order){
    return order ? ownerLabelById(order.ownerId) : "—";
  }


  // ---------- Roles & Permissions (core/permissions) ----------
  const { permissions, canAccess, applyRoleVisibility, findRole, hasRoleKey } = createPermissionsApi({
    state,
    ensureSession,
    getCurrentUser,
    getCurrentUserId
  });

  function updateProfileButton(){
      if(!els.profileBtn) return;
      const { user } = permissions();
      const txt = (user && user.initials) ? user.initials : 'SO';
      // Markup: <button class="avatar" id="btn-profile"><span>SO</span></button>
      const avatarSpan = els.profileBtn.querySelector('span');
      if(avatarSpan){
        avatarSpan.textContent = txt;
      } else {
        // Fallback, falls Markup vereinfacht wurde
        els.profileBtn.textContent = txt;
      }
      const label = user ? `Testperson: ${user.name}` : 'Testperson wählen';
      els.profileBtn.setAttribute('title', label);
      els.profileBtn.setAttribute('aria-label', `${label}. Klicken zum Wechseln.`);
    }


  // ---------- GovConnect shell: Organisation / Arbeitgeber-Kontext (Demo) ----------
  // Vorgabe: Eine Person hat genau einen Arbeitgeber.
  // - Stadt-Persona: Kreisverwaltung ist nicht sichtbar.
  // - Landesnetz bleibt als interkommunales Netz sichtbar.
  function allowedOrgContextsForUser(user){
    // Demo-Vereinfachung: Wir zeigen nur die Kreisstadt Exempla.
    return ["city"];
  }

  function ensureOrgContextAllowed(){
    const { user } = permissions();
    const allowed = allowedOrgContextsForUser(user);
    const cur = String(state.ui.orgContext || "city");
    if(!allowed.includes(cur)){
      state.ui.orgContext = allowed[0] || "city";
      saveState();
    }
    return allowed;
  }

  function applyOrgContext(){
    const allowed = ensureOrgContextAllowed();
    const key = String(state.ui.orgContext || (allowed[0] || "city"));
    const ctx = ORG_CONTEXTS[key] || ORG_CONTEXTS.city;

    document.querySelectorAll("[data-org-name]").forEach((el)=>{ el.textContent = ctx.name; });
    document.querySelectorAll("[data-org-sub]").forEach((el)=>{ el.textContent = ctx.sub; });

    if(els.orgSwitch){
      els.orgSwitch.querySelectorAll(".orgSwitch__item").forEach((btn)=>{
        const orgKey = btn.getAttribute("data-org");
        const ok = allowed.includes(orgKey);
        btn.style.display = ok ? "" : "none";
        btn.classList.toggle("is-active", orgKey === key);
      });
    }
  }

  function setOrgContext(next){
    const { user } = permissions();
    const allowed = allowedOrgContextsForUser(user);
    const key = (next && ORG_CONTEXTS[next] && allowed.includes(next)) ? next : (allowed[0] || "city");
    state.ui.orgContext = key;
    saveState();
    applyOrgContext();
    render();
  }


  // ---------- Router (core/router) ----------
  // Router is initialized near the bottom (after all route handlers are defined).
  let router = null;

  function routeFromHash(){
    return router ? router.routeFromHash() : "/app/start";
  }

  function navTo(route){
    if(router) return router.navTo(route);
    location.hash = "#" + (route || "/app/start");
  }

  function render(){
    if(router) return router.render();
  }

  // ---------- Utilities ----------
  const util = { eur, dt };



  // ---------- Stammdaten: Organisation / Kostenstellen (Demo) ----------
  // In der v0.12 werden Organisationseinheit & Kostenstelle als Stammdaten modelliert,
  // damit Führungskräfte (Dashboard/Report) später sauber nach Strukturen filtern können.
  const ORG_MODEL = (mock && mock.orgModel) ? mock.orgModel : null;

  function orgUnitsFlat(){
    const out = [];
    const deps = ORG_MODEL && Array.isArray(ORG_MODEL.departments) ? ORG_MODEL.departments : [];
    for(const d of deps){
      const units = Array.isArray(d.units) ? d.units : [];
      for(const u of units){
        out.push(Object.assign({}, u, {
          deptId: d.id,
          deptName: d.name
        }));
      }
    }
    return out;
  }

  const ORG_UNITS = orgUnitsFlat();
  const ORG_BY_ID = Object.fromEntries(ORG_UNITS.map(u=> [u.id, u]));
  // Backwards-compat alias (older code paths / helper functions may refer to ORG_UNIT_BY_ID)
  const ORG_UNIT_BY_ID = ORG_BY_ID;
  const ORG_BY_LABEL = Object.fromEntries(ORG_UNITS.map(u=> [String(u.label||"").trim(), u]));

  const COSTCENTER_BY_CODE = (function(){
    const m = {};
    for(const u of ORG_UNITS){
      for(const cc of (u.costCenters || [])){
        if(cc && cc.code) m[String(cc.code)] = { code: String(cc.code), name: String(cc.name||"") };
      }
    }
    return m;
  })();

  const ALL_LOCATIONS = (function(){
    const s = new Set();
    for(const u of ORG_UNITS){
      for(const l of (u.locations || [])) s.add(String(l));
    }
    return Array.from(s);
  })();

  function formatOrgUnit(u){
    if(!u) return "–";
    const label = u.label ? String(u.label) : "Organisation";
    const name = u.name ? String(u.name) : "";
    return name ? `${label} · ${name}` : label;
  }

  function parseAmtLabel(s){
    const m = String(s||"").match(/\bAmt\s*(\d{2})\b/i);
    return m ? `Amt ${m[1]}` : "";
  }

  function orderOrgUnit(order){
    if(!order) return null;
    if(order.orgId && ORG_BY_ID[order.orgId]) return ORG_BY_ID[order.orgId];
    if(order.org && ORG_BY_LABEL[String(order.org).trim()]) return ORG_BY_LABEL[String(order.org).trim()];
    const lbl = parseAmtLabel(order.org);
    if(lbl && ORG_BY_LABEL[lbl]) return ORG_BY_LABEL[lbl];
    return null;
  }

  function orderOrgLabel(order){
    const u = orderOrgUnit(order);
    if(u) return formatOrgUnit(u);
    return order && order.org ? String(order.org) : "–";
  }

  function orderDeptLabel(order){
    const u = orderOrgUnit(order);
    return u && u.deptName ? String(u.deptName) : "–";
  }

  function personById(id){
    if(!id) return null;
    if(PERSONNEL && PERSONNEL.peopleById && PERSONNEL.peopleById[id]) return PERSONNEL.peopleById[id];
    return PEOPLE.find(p=>p.id===id) || null;
  }

  function orderOwner(order){
    return order && order.ownerId ? personById(order.ownerId) : null;
  }

  function orderInDept(order, deptId){
    if(!deptId) return false;
    const u = orderOrgUnit(order);
    return !!(u && u.deptId === deptId);
  }

  function orderInUnit(order, unitId){
    if(!unitId) return false;
    const u = orderOrgUnit(order);
    return !!(u && u.id === unitId);
  }

  // Sichtbarkeit von Anforderungen nach Persona:
  // - Org/central: alle
  // - Dept (FB-Leitung/Freigabe): nur Fachbereich
  // - Unit (Amtsleitung): nur Amt
  // - sonst: nur eigene (ownerId)
  function orderVisibleToUser(order, caps){
    const user = caps.user;
    if(!user) return false;
    if(caps.leadOrg || caps.isCentral) return true;
    if(caps.leadDept) return orderInDept(order, caps.leadDept.scopeId);
    if(caps.approverDept) return orderInDept(order, caps.approverDept.scopeId);
    if(caps.leadUnit) return orderInUnit(order, caps.leadUnit.scopeId);
    return !!(order.ownerId && order.ownerId === user.id);
  }

  function visibleOrdersForCurrentUser(list){
    const caps = permissions();
    const arr = Array.isArray(list) ? list : state.orders;
    return arr.filter(o=>orderVisibleToUser(o, caps));
  }

  // Interne Kostenstellen (nur für Buchungs-/KPI-Logik, nicht zur Auswahl in der Front Door)
  const INTERNAL_COSTCENTERS = {
    "ZB-VERSAND": { code: "ZB-VERSAND", name: "ZB Versandkosten" }
  };
  const ZB_SHIPPING_COSTCENTER = "ZB-VERSAND";

  function costCenterLabel(code){
    const key = String(code||"");
    const c = INTERNAL_COSTCENTERS[key] || COSTCENTER_BY_CODE[key];
    if(!c) return key ? String(key) : "–";
    return c.name ? `${c.code} · ${c.name}` : c.code;
  }

  // Kompakte Darstellung für UI-Pills (verhindert sehr lange Zeilen)
  function costCenterCompactLabel(code, maxNameLen = 18){
    const key = String(code||"");
    const c = INTERNAL_COSTCENTERS[key] || COSTCENTER_BY_CODE[key];
    if(!c) return key ? String(key) : "–";
    const name = c.name ? String(c.name) : "";
    if(!name) return c.code;
    const n = name.trim();
    const shortName = n.length > maxNameLen ? (n.slice(0, Math.max(0, maxNameLen-1)).trimEnd() + "…") : n;
    return `${c.code} · ${shortName}`;
  }

  function supplierByName(name){
    const list = (mock && Array.isArray(mock.suppliers)) ? mock.suppliers : [];
    return list.find(s => String(s.name) === String(name)) || null;
  }

  function vendorPolicy(vendorName){
    const s = supplierByName(vendorName);
    const mbw = (s && typeof s.mbw === "number") ? Number(s.mbw) : null;
    const shippingFeeUnderMbw = (s && typeof s.shippingFeeUnderMbw === "number") ? Number(s.shippingFeeUnderMbw) : null;
    return { mbw, shippingFeeUnderMbw };
  }

  function contractInfo(contractName){
    const map = CONTRACTS;
    const key = String(contractName || "").trim();
    if(!map || !key) return null;
    return map[key] || null;
  }

  function orderCostCenterLabel(order){
    return costCenterLabel(order && order.costCenter);
  }

  // ---------- v0.13.1: Repair/Migration (Org-Filter-Fähigkeit) ----------
  // Problem: Wenn ein Nutzer aus einer älteren Demo-Version kommt, können in localStorage
  //          historische Orders noch Organisationslabels enthalten, die es in der Exempla-Orga nicht mehr gibt
  //          (z.B. „Amt 60“). Dann filtert das Dashboard (Fachbereich/Amt) alles weg.
  // Ziel:     Bestandsdaten automatisch auf die aktuelle Orga-Struktur mappen, ohne dass Nutzer
  //          händisch localStorage löschen müssen.

  function numSchema(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function mapLegacyAmtToUnit(amtNumber){
    const n = Number(amtNumber);
    if(!Number.isFinite(n) || !ORG_UNITS.length) return ORG_UNITS[0] || null;

    // Prefer mapping by "tens group" to keep it plausible (10er → FB1, 20er → FB2 ...)
    const tens = Math.floor(n / 10) * 10;
    const groups = {
      10: ["A11","A12","A13"],
      20: ["A21","A22","A23"],
      30: ["A31","A32","A33"],
      40: ["A41","A42","A43"]
    };

    const ids = groups[tens] || null;
    if(ids){
      const idx = (n % 10) % ids.length;
      const u = ORG_BY_ID[ids[idx]] || ORG_BY_ID[ids[0]];
      return u || ORG_UNITS[0] || null;
    }

    // Fallback: deterministic but evenly distributed
    const idx = Math.abs(n) % ORG_UNITS.length;
    return ORG_UNITS[idx] || ORG_UNITS[0] || null;
  }

  function resolveUnitFromLooseOrgString(orgStr){
    const s = String(orgStr || "").trim();
    if(!s) return null;

    // 1) Exact label match
    if(ORG_BY_LABEL[s]) return ORG_BY_LABEL[s];

    // 2) Extract "Amt NN" from longer strings
    const m = s.match(/\bAmt\s*(\d{2})\b/i);
    if(m){
      const lbl = `Amt ${m[1]}`;
      if(ORG_BY_LABEL[lbl]) return ORG_BY_LABEL[lbl];
      return mapLegacyAmtToUnit(Number(m[1]));
    }

    // 3) Weak name match (best-effort)
    const lower = s.toLowerCase();
    for(const u of ORG_UNITS){
      const name = String(u.name || "").toLowerCase();
      if(name && lower.includes(name)) return u;
    }

    return null;
  }

  function repairOrderOrgFields(order){
    if(!order) return { changed: false, hadUnknown: false };

    let changed = false;
    let hadUnknown = false;

    // Try normal resolution first
    let u = orderOrgUnit(order);
    if(!u){
      hadUnknown = true;
      u = resolveUnitFromLooseOrgString(order.org);
    }

    // Last-resort fallback: assign deterministically to a valid Amt.
    // This prevents dashboard filters from "emptying" the dataset due to legacy/unknown org strings.
    if(!u && ORG_UNITS.length){
      const s = String(order.id || order.createdAt || Math.random());
      let h = 0;
      for(let i=0;i<s.length;i++) h = ((h<<5)-h) + s.charCodeAt(i);
      const idx = Math.abs(h) % ORG_UNITS.length;
      u = ORG_UNITS[idx] || ORG_UNITS[0] || null;
    }

    if(u){
      // Persist orgId for future robustness
      if(!order.orgId || String(order.orgId) !== String(u.id)){
        order.orgId = String(u.id);
        changed = true;
      }

      // Normalize displayed org label to keep it consistent in tables/PDF
      const normalizedLabel = String(u.label || "").trim();
      if(normalizedLabel && String(order.org || "").trim() !== normalizedLabel){
        order.org = normalizedLabel;
        changed = true;
      }

      // Repair costCenter if incompatible with the selected Amt
      const allowed = (u.costCenters || []).map(cc => String(cc.code));
      if(allowed.length){
        const cur = String(order.costCenter || "");
        if(cur && !allowed.includes(cur)){
          order.costCenter = allowed[0];
          changed = true;
        }
        if(!cur){
          order.costCenter = allowed[0];
          changed = true;
        }
      }

      // Repair location if empty
      if((!order.location || !String(order.location).trim()) && Array.isArray(u.locations) && u.locations.length){
        order.location = u.locations[0];
        changed = true;
      }
    }

    return { changed, hadUnknown };
  }

  function repairOrgDataIfNeeded(){
    // Runs once per schema version.
    const current = 14.0;
    const prev = numSchema(state.ui && state.ui.schemaVersion);
    if(prev >= current) return;

    let changedAny = false;
    let unknownCount = 0;

    const all = [].concat(state.orders || [], state.historyOrders || []);
    for(const o of all){
      const r = repairOrderOrgFields(o);
      if(r.changed) changedAny = true;
      if(r.hadUnknown) unknownCount += 1;
    }

    // If history looks very "legacy" (many unknown orgs or no split data), replace it with fresh mock history.
    const hist = Array.isArray(state.historyOrders) ? state.historyOrders : [];
    const histWithSplits = hist.filter(o => splitParts(o).length > 0).length;
    const histRatioSplits = hist.length ? (histWithSplits / hist.length) : 0;

    const histUnknown = hist.filter(o => !orderOrgUnit(o)).length;
    const histUnknownRatio = hist.length ? (histUnknown / hist.length) : 0;

    const shouldResetHistory = (hist.length > 0) && (histRatioSplits < 0.3 || histUnknownRatio > 0.4);
    if(shouldResetHistory){
      state.historyOrders = deepClone(mock.historyOrders || []);
      // Repair the newly seeded history as well (sets orgId/costCenter/location consistently)
      for(const o of (state.historyOrders || [])) repairOrderOrgFields(o);
      changedAny = true;
    }

    state.ui.schemaVersion = current;
    if(changedAny){
      saveState();

      // Housekeeping: remove very old demo states to avoid loading confusion in future runs.
      try{
        if(Array.isArray(STORAGE_KEYS_FALLBACK)){
          for(const k of STORAGE_KEYS_FALLBACK){
            if(k && k !== STORAGE_KEY) localStorage.removeItem(k);
          }
        }
      }catch(_){/* ignore */}
    }

    // Optional: tiny activity ping so it is visible that the demo repaired itself (only once)
    if(unknownCount > 0 && !state.ui.orgRepairNotified){
      state.ui.orgRepairNotified = true;
      pushActivity({
        text: "Hinweis: Demo-Daten wurden automatisch an die aktuelle Exempla-Orga angepasst (Migration).",
        audience: ["lead"]
      });
      saveState();
    }

  }

  function ensureOrderOwners(){
    // ownerId ist die Basis für Sichtbarkeit ("Meine Anforderungen") und für die spätere Rollenlogik.
    if(!Array.isArray(state.orders)) return;

    // Kandidaten je Einheit
    const byUnit = {};
    for(const p of PEOPLE){
      if(!p || !p.id) continue;
      const unitId = p.unitId ? String(p.unitId) : "";
      if(!unitId) continue;
      if(!byUnit[unitId]) byUnit[unitId] = [];
      byUnit[unitId].push(p);
    }

    const allPeople = PEOPLE.filter(p=>p && p.id);

    function pickOwnerId(order){
      const u = orderOrgUnit(order);
      const unitId = u ? String(u.id || "") : "";
      const candidates = (unitId && byUnit[unitId] && byUnit[unitId].length) ? byUnit[unitId] : allPeople;
      if(!candidates.length) return null;

      // Deterministische Auswahl: nutze numerischen Teil der ID
      const digits = String(order.id || "").replace(/\D/g, "");
      const num = digits ? Number(digits.slice(-6)) : 0;
      return candidates[num % candidates.length].id;
    }

    let changed = false;

    function ensureOn(list){
      if(!Array.isArray(list)) return;
      for(const o of list){
        if(!o || typeof o !== 'object') continue;
        if(!o.ownerId){
          const ownerId = pickOwnerId(o);
          if(ownerId){
            o.ownerId = ownerId;
            changed = true;
          }
        }
      }
    }

    ensureOn(state.orders);
    ensureOn(state.historyOrders);

    if(changed) saveState();
  }


  function tpl(id){
    const t = document.getElementById(id);
    return t ? t.innerHTML : "";
  }

  // ---------- Order helpers (domain/order) ----------
  // Moved out of app.js to keep the shell lean.

  function statusTag(status){
    const cat = statusCategory(status);
    const cls =
      (status === "Rückfrage") ? "status status--question"
      : (cat === "approval") ? "status status--approval"
      : (cat === "done") ? (status === "Abgelehnt" ? "status status--rejected" : "status status--done")
      : "status status--open";
    return '<span class="' + cls + '">' + escapeHtml(status) + '</span>';
  }

  function countByCategory(cat, list){
    const arr = Array.isArray(list) ? list : state.orders;
    return arr.filter(o => statusCategory(o.status) === cat).length;
  }

  function orderGateReasonText(order){
    return orderGateReason(order, {
      gateThreshold: Number(mock.meta.gateThreshold || 25),
      catalog: state.catalog
    });
  }

  // ---------- Activities / Chronik ----------
  function normalizeAudience(a){
    if(!a) return ["all"];
    if(Array.isArray(a) && a.length) return a;
    if(typeof a === "string") return [a];
    return ["all"];
  }

  function audienceLabel(aud){
    const arr = normalizeAudience(aud);
    if(arr.includes("all")) return "Alle";
    const map = {
      user: "Mitarbeitende",
      approver: "Freigabe",
      central: "Zentrale Beschaffung",
      lead: "Leitung"
    };
    return arr.map(x => map[x] || String(x)).join(" · ");
  }

  function activityVisibleToRoles(act, roles){
    const aud = normalizeAudience(act.audience);
    if(aud.includes("all")) return true;
    const rs = Array.isArray(roles) ? roles : [];
    return rs.some(r => aud.includes(r));
  }

  function getSeenAt(userId){
    const m = state.ui.activitySeenAtByUser || {};
    const k = userId || "_";
    return m[k] || null;
  }

  function setSeenAt(userId, at){
    if(!state.ui.activitySeenAtByUser) state.ui.activitySeenAtByUser = {};
    const k = userId || "_";
    state.ui.activitySeenAtByUser[k] = at;
  }

  function markAllSeen(){
    const p = permissions();
    const visible = state.activities.filter(a => activityVisibleToRoles(a, p.roles));
    const latest = visible.length ? visible[0].at : nowIso();
    setSeenAt(p.userId, latest);
    saveState();
    updateActivityBadge();
  }

  function unreadCount(){
    const p = permissions();
    const seenAt = getSeenAt(p.userId);
    const visible = state.activities.filter(a => activityVisibleToRoles(a, p.roles));
    if(!visible.length) return 0;
    if(!seenAt) return visible.length;
    const seen = new Date(seenAt).getTime();
    return visible.filter(a => new Date(a.at).getTime() > seen).length;
  }

  function updateActivityBadge(){
    if(!els.activityBadge) return;
    const n = unreadCount();
    els.activityBadge.textContent = String(n);
    els.activityBadge.style.display = n > 0 ? "grid" : "none";
  }

  function pushActivity({ text, orderId, audience }){
    const a = {
      id: `act_${Math.random().toString(36).slice(2)}_${Date.now()}`,
      at: nowIso(),
      text: String(text || "Aktivität"),
      orderId: orderId || undefined,
      audience: normalizeAudience(audience)
    };
    state.activities.unshift(a);
    // keep feed compact
    state.activities = state.activities.slice(0, 80);
    saveState();
    updateActivityBadge();
  }

  function openActivityModal(){
    const p = permissions();
    const visible = state.activities.filter(a => activityVisibleToRoles(a, p.roles));

    if(!visible.length){
      openModal(`<div class="callout"><div class="callout__title">Keine Aktivitäten</div><div class="callout__text">Der Feed ist leer (Mock-Demo).</div></div>`, { title: "Aktivität" });
      return;
    }

    const list = visible.slice(0, 12);

    openModal(`
      <div class="row row--space">
        <div>
          <div class="h2" style="margin:0;">Aktivität</div>
          <div class="muted small">Neueste Einträge (role-aware).</div>
        </div>
        <button class="btn" id="btn-modal-markread">Als gelesen</button>
      </div>
      <div class="divider"></div>
      <div class="feed">
        ${list.map(a=>`
          <div class="feedItem">
            <div>
              <div class="feedItem__title">${escapeHtml(a.text)}</div>
              <div class="feedItem__meta">${escapeHtml(util.dt(a.at))}${a.orderId ? ` · <a class="feedItem__link" href="#/app/orders" data-open-order="${escapeHtml(a.orderId)}" data-close="1">${escapeHtml(a.orderId)}</a>` : ""}</div>
            </div>
            <div class="feedItem__right">
              <span class="pill">${escapeHtml(audienceLabel(a.audience))}</span>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="row row--space" style="margin-top:12px;">
        <div class="muted small">Vollansicht über die Chronik.</div>
        <a class="btn" href="#/chronik" data-close="1">Zur Chronik</a>
      </div>
    `, { title: "Aktivität" });

    const btn = document.getElementById("btn-modal-markread");
    if(btn){
      btn.addEventListener("click", ()=>{
        markAllSeen();
        closeModal();
      });
    }

    // If user clicks an order link, we pre-fill search and open details after navigation.
    document.querySelectorAll("[data-open-order]").forEach(link=>{
      link.addEventListener("click", ()=>{
        const id = link.getAttribute("data-open-order");
        if(!id) return;
        state.ui.ordersFilter = "all";
        state.ui.ordersSearch = id;
        saveState();
        // The navigation happens via href. Details open once table mounts.
        // We'll use a short-lived flag in state.ui
        state.ui.openOrderIdOnce = id;
        saveState();
      });
    });
  }

  // ---------- Persona chooser (SO avatar) ----------
  function openProfileModal(){
    ensureSession();
    const caps = permissions();

    const units = (PERSONNEL && Array.isArray(PERSONNEL.orgUnits))
      ? PERSONNEL.orgUnits
      : [...ORG_UNITS, { id: 'ZB', label: 'ZB', name: 'Zentrale Beschaffung' }, { id: 'IT', label: 'IT', name: 'IT‑Service' }];

    const unitOptions = ['<option value="all">Alle Einheiten</option>']
      .concat(units.map(u=>`<option value="${escapeHtml(String(u.id))}">${escapeHtml(String(u.label || u.id))} · ${escapeHtml(String(u.name || ''))}</option>`))
      .join('');

    const title = 'Testperson wählen';
    const body = `
      <div class="card">
        <div class="card__body">
          <div class="row" style="gap:10px; align-items:end; flex-wrap:wrap;">
            <div style="flex:1; min-width:220px;">
              <label class="label">Suche</label>
              <input class="input" id="pp-q" placeholder="Name…" />
            </div>
            <div style="min-width:280px;">
              <label class="label">Einheit</label>
              <select class="select" id="pp-unit">${unitOptions}</select>
            </div>
          </div>

          <div class="muted" style="margin-top:10px;">
            Aktuell: <strong>${escapeHtml(caps.user ? caps.user.name : '—')}</strong>
            ${caps.roleLabel ? `<span class="muted"> · ${escapeHtml(caps.roleLabel)}</span>` : ''}
          </div>

          <div class="ppList" id="pp-list" style="margin-top:12px;"></div>
        </div>
      </div>
    `;

    // Modal API: openModal(html, { title })
    openModal(body, { title });

    const qEl = document.getElementById('pp-q');
    const unitEl = document.getElementById('pp-unit');
    const listEl = document.getElementById('pp-list');

    function roleBadges(person){
    const badges = [];

    // Präzise Rollenerkennung (für die Demo muss man sofort sehen, wen man auswählt)
    const isCentral = !!findRole(person, "central", "org", "org");
    const isLeadOrg = !!findRole(person, "lead", "org", "org");
    const isLeadDept = !!findRole(person, "lead", "dept");
    const isLeadUnit = !!findRole(person, "lead", "unit");
    const isApproverDept = !!findRole(person, "approver", "dept");

    if(isCentral) badges.push({ text: "Zentrale Beschaffung", className: "badge badge--blue" });
    if(isLeadDept) badges.push({ text: "Fachbereichsleitung", className: "badge badge--red" });
    if(isLeadUnit) badges.push({ text: "Amtsleitung", className: "badge badge--red" });
    if(isApproverDept) badges.push({ text: "Freigabe (Fachbereich)", className: "badge badge--purple" });
    if(isLeadOrg) badges.push({ text: "Leitung (gesamt)", className: "badge badge--red" });

    if(!badges.length) badges.push({ text: "Mitarbeitende", className: "badge" });
    return badges;
  }

  function unitText(person){
      const unitId = person.unitId ? String(person.unitId) : '';
      const u = unitId ? (ORG_BY_ID[unitId] || (PERSONNEL && PERSONNEL.unitById ? PERSONNEL.unitById[unitId] : null)) : null;
      const label = u ? String(u.label || u.id) : (unitId || '—');
      const name = u ? String(u.name || '') : '';
      const base = name ? `${label} · ${name}` : label;
      return person.title ? `${base} · ${person.title}` : base;
    }

    function doSwitch(id){
      if(!id) return;
      state.session.userId = id;
      saveState();
      closeModal();

      updateProfileButton();
      applyRoleVisibility();
      updateActivityBadge();

      // Wenn Route nicht erlaubt -> Fallback
      const route = routeFromHash();
      if(!canAccess(route)){
        const c = permissions();
        if(c.canDashboard) return navTo('/app/dashboard');
        if(c.canBatch) return navTo('/app/batch');
        if(c.canApprovals) return navTo('/app/approvals');
        return navTo('/app/start');
      }

      render();
    }

    function renderList(){
      if(!listEl) return;
      const q = (qEl && qEl.value ? qEl.value.trim().toLowerCase() : '');
      const unit = (unitEl && unitEl.value) ? unitEl.value : 'all';

      const items = (Array.isArray(PEOPLE) ? PEOPLE : [])
        .filter(p=>p && p.id && p.name)
        .filter(p=> unit === 'all' ? true : String(p.unitId || '') === String(unit))
        .filter(p=> q ? p.name.toLowerCase().includes(q) : true)
        .slice(0, 250);

      listEl.innerHTML = items.map(p=>{
        const active = String(p.id) === String(state.session.userId);
        const badges = roleBadges(p);
        const badgeHtml = badges.length
          ? `<span class="ppBadges">${badges.map(b=>`<span class="${b.className}">${escapeHtml(b.text)}</span>`).join(' ')}</span>`
          : '';

        return `
          <button class="ppItem" data-user="${escapeHtml(String(p.id))}" ${active ? 'aria-current="true"' : ''}>
            <span class="ppAvatar">${escapeHtml(p.initials || 'SO')}</span>
            <span class="ppMain">
              <span class="ppName">${escapeHtml(p.name)}</span>
              <span class="ppMeta">${escapeHtml(unitText(p))}</span>
              ${badgeHtml}
            </span>
          </button>
        `;
      }).join('') || '<div class="muted">Keine Treffer.</div>';

      listEl.querySelectorAll('.ppItem').forEach(btn=>{
        btn.addEventListener('click', ()=> doSwitch(btn.getAttribute('data-user')) );
      });
    }

    if(qEl) qEl.addEventListener('input', renderList);
    if(unitEl) unitEl.addEventListener('change', renderList);

    renderList();
  }

  // ---------- Shell Views (nur Rahmen / Demo) ----------
  function renderShellHome(){
    els.content.innerHTML = tpl("tpl-shell-home");
  }

  function renderShellPersonen(){
    els.content.innerHTML = tpl("tpl-shell-personen");
    mountPeople();
  }

  function renderShellBereiche(){
    els.content.innerHTML = tpl("tpl-shell-bereiche");
  }

  function renderShellDokumente(){
    els.content.innerHTML = tpl("tpl-shell-dokumente");
  }

  function renderShellApps(){
    els.content.innerHTML = tpl("tpl-shell-apps");
  }


  // ---------- View: Dokumente (Drive) ----------
  function mountDocuments(){
    return mountDocumentsImpl({
      state,
      saveState,
      openModal
    });
  }

  // ---------- View: Personen ----------
  function mountPeople(){
    return mountPeopleImpl({
      state,
      saveState,
      openModal,
      people: PEOPLE,
      leadership: LEADERSHIP,
      orgModel: ORG_MODEL
    });
  }


  function renderPlaceholder(title){
    els.content.innerHTML = `
      <div class="page">
        <div class="page__header">
          <div>
            <h1 class="h1">${escapeHtml(title)}</h1>
            <p class="muted">Platzhalter im Shell‑Rahmen. Interaktiv ist die App „Social Order“.</p>
          </div>
          <div class="page__actions">
            <a class="btn btn--primary" href="#/app/start">Zur App</a>
          </div>
        </div>
        <div class="card"><div class="card__body">
          <div class="callout">
            <div class="callout__title">Warum das hier existiert</div>
            <div class="callout__text">Die Shell sorgt für den „Intranet‑Effekt“ (Rahmen, Navigation, Kontext). Für die Demo ist Social Order der interaktive Teil.</div>
          </div>
        </div></div>
      </div>
    `;
  }

  function renderChronik(){
    els.content.innerHTML = tpl("tpl-chronik");
    mountChronik();
  }

  function mountChronik(){
    const feedEl = document.getElementById("chronik-feed");
    const btnMark = document.getElementById("btn-chronik-markread");

    const p = permissions();
    const visible = state.activities.filter(a => activityVisibleToRoles(a, p.roles));

    if(!feedEl) return;

    if(!visible.length){
      feedEl.innerHTML = `<div class="cart__empty">Keine Einträge in der Chronik.</div>`;
    }else{
      feedEl.innerHTML = visible.slice(0, 30).map(a=>`
        <div class="feedItem">
          <div>
            <div class="feedItem__title">${escapeHtml(a.text)}</div>
            <div class="feedItem__meta">${escapeHtml(util.dt(a.at))}${a.orderId ? ` · ${escapeHtml(a.orderId)}` : ""}</div>
          </div>
          <div class="feedItem__right">
            ${a.orderId ? `<a class="btn" href="#/app/orders" data-open-order="${escapeHtml(a.orderId)}">Öffnen</a>` : ""}
          </div>
        </div>
      `).join("");

      feedEl.querySelectorAll("[data-open-order]").forEach(link=>{
        link.addEventListener("click", ()=>{
          const id = link.getAttribute("data-open-order");
          if(!id) return;
          state.ui.ordersFilter = "all";
          state.ui.ordersSearch = id;
          state.ui.openOrderIdOnce = id;
          saveState();
        });
      });
    }

    if(btnMark){
      btnMark.addEventListener("click", ()=>{
        markAllSeen();
        // re-render to reflect badge (optional)
        renderChronik();
      });
    }

    // entering chronik counts as reading
    markAllSeen();
  }

  // ---------- Router init (core/router) ----------
  const ROUTES = {
    // Shell
    "/home": () => renderShellHome(),
    "/chronik": () => renderChronik(),
    "/personen": () => renderShellPersonen(),
    "/bereiche": () => renderShellBereiche(),
    "/dokumente": () => { els.content.innerHTML = tpl("tpl-shell-dokumente"); mountDocuments(); },
    "/apps": () => renderShellApps(),

    // Legacy placeholders
    "/chats": () => renderPlaceholder("Chats"),
    "/kalender": () => renderPlaceholder("Kalender"),
    "/feed": () => renderPlaceholder("Neuigkeiten"),
    "/newsroom": () => renderPlaceholder("Newsroom"),
    "/gruppen": () => renderPlaceholder("Gruppen"),
    "/projekte": () => renderPlaceholder("Projekte"),

    // About
    "/about": () => { els.content.innerHTML = tpl("tpl-about"); },

    // Social Order App
    "/app/start": () => {
      els.content.innerHTML = tpl("tpl-app-start");
      renderStartKpis();
    },
    "/app/new": () => {
      els.content.innerHTML = tpl("tpl-app-new");
      mountNewOrder();
    },
    "/app/orders": () => {
      els.content.innerHTML = tpl("tpl-app-orders");
      mountOrders();
    },
    "/app/approvals": () => {
      els.content.innerHTML = tpl("tpl-app-approvals");
      mountApprovals();
    },
    "/app/batch": () => {
      els.content.innerHTML = tpl("tpl-app-batch");
      mountBatch();
    },
    "/app/dashboard": () => {
      els.content.innerHTML = tpl("tpl-app-dashboard");
      mountDashboard();
    }
  };

  router = createHashRouter({
    permissions,
    canAccess,
    routes: ROUTES,
    afterRender: () => {
      applyRoleVisibility();
      updateActivityBadge();
      applyOrgContext();
    }
  });

  function renderStartKpis(){
    const cutoff = document.getElementById("kpi-cutoff");
    if(cutoff) cutoff.textContent = mock.meta.cutoffLabel;

    const visible = visibleOrdersForCurrentUser(state.orders);
    const open = countByCategory("open", visible);
    const approval = countByCategory("approval", visible);

    const elOpen = document.getElementById("kpi-open");
    const elApproval = document.getElementById("kpi-approval");
    if(elOpen) elOpen.textContent = String(open);
    if(elApproval) elApproval.textContent = String(approval);
  }

  // ---------- View: Dashboard (Lead) ----------
  function mountDashboard(){
    return mountDashboardImpl({
      state,
      mock,
      permissions,
      saveState,
      visibleOrdersForCurrentUser,
      orderTotal,
      orderVendors,
      orderVendor,
      orderOrgUnit,
      orderOrgLabel,
      splitParts,
      costCenterLabel,
      findOrderById,
      openOrderDetails,
      openModal,
      escapeHtml,
      util,
      ORG_MODEL,
      ORG_BY_ID,
      ORG_UNITS,
      formatOrgUnit
    });
  }

  function printCurrentModal(){
    const ctx = getModalContext();
    if(!ctx || ctx.type !== "order") return;
    const order = findOrderById(ctx.orderId);
    if(!order) return;

    if(els.printRoot){
      els.printRoot.innerHTML = buildPrintOrderHtmlImpl(getSoOrdersCtx(), order);
      els.printRoot.setAttribute("aria-hidden","false");
    }

	    const cleanup = ()=>{
	      window.removeEventListener("afterprint", cleanup);
	      clearPrintRoot();
	    };
	    window.addEventListener("afterprint", cleanup);
	    window.print();
	    // Fallback: some browsers won't fire `afterprint` reliably.
	    setTimeout(cleanup, 5000);
  }

  // ---------- View: New Order (apps/so_new) ----------
  function mountNewOrder(){
    return mountNewOrderImpl({
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
    });
  }

  // ---------- View: Orders (apps/so_orders) ----------

  function getSoOrdersCtx(){
    return {
      state,
      mock,
      permissions,
      saveState,
      openModal,
      closeModal,
      nowIso,
      pushActivity,
      navTo,
      getCurrentUserId,
      escapeHtml,
      util,
      statusTag,
      ownerLabelById,
      ownerNameById,
      orderOwnerLabel,
      orderOrgLabel,
      orderDeptLabel,
      orderCostCenterLabel,
      visibleOrdersForCurrentUser,
      orderGateReason: orderGateReasonText
    };
  }

  function mountOrders(){
    return mountOrdersImpl(getSoOrdersCtx());
  }

  function openOrderDetails(order){
    return openOrderDetailsImpl(getSoOrdersCtx(), order);
  }

  function mountApprovals(){
    const approvalsCtx = Object.assign({}, getSoOrdersCtx(), {
      orderInDept,
      orderInUnit,
      orderOwner,
      render
    });
    return mountApprovalsImpl(approvalsCtx);
  }

  // ---------- View: Batch ----------
  function mountBatch(){
    return mountBatchImpl({
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
    });
  }


  // ---------- Global handlers ----------
  function bindGlobal(){
    if(els.modalClose) els.modalClose.addEventListener("click", closeModal);

    if(els.modalPrint) els.modalPrint.addEventListener("click", printCurrentModal);
    window.addEventListener("afterprint", clearPrintRoot);

    if(els.modal){
      els.modal.addEventListener("click", (e)=>{
        const t = e.target;
        if(t && t.getAttribute && t.getAttribute("data-close") === "1") closeModal();
      });
    }

    document.addEventListener("keydown", (e)=>{
      if(e.key === "Escape") closeModal();
    });

    if(els.themeBtn){
      els.themeBtn.addEventListener("click", toggleTheme);
    }

    if(els.activityBtn){
      els.activityBtn.addEventListener("click", ()=>{
        openActivityModal();
        // viewing activity counts as "seen"
        markAllSeen();
      });
    }

    if(els.profileBtn){
      els.profileBtn.addEventListener("click", ()=>{
        openProfileModal();
      });
    }

    if(els.orgSwitch){
      els.orgSwitch.addEventListener("click", (e)=>{
        const btn = e.target.closest("button[data-org]");
        if(!btn) return;
        setOrgContext(btn.getAttribute("data-org"));
      });
    }

    if(els.burger){
      els.burger.addEventListener("click", ()=>{
        const isHidden = getComputedStyle(els.sidebar).display === "none";
        if(isHidden){
          els.sidebar.style.display = "block";
          els.sidebar.style.position = "fixed";
          els.sidebar.style.top = "64px";
          els.sidebar.style.left = "0";
          els.sidebar.style.bottom = "0";
          els.sidebar.style.zIndex = "60";
          els.sidebar.style.width = "320px";
          els.sidebar.style.boxShadow = "0 18px 40px rgba(0,0,0,.55)";
        }else{
          els.sidebar.removeAttribute("style");
        }
      });
    }

    if(els.globalSearch){
      els.globalSearch.addEventListener("keydown", (e)=>{
        if(e.key !== "Enter") return;
        const q = els.globalSearch.value.trim();
        if(!q) return;
        state.ui.ordersFilter = "all";
        state.ui.ordersSearch = q;
        saveState();
        navTo("/app/orders");
        els.globalSearch.blur();
      });
    }

    window.addEventListener("hashchange", render);

    // close modal on internal CTA links that have data-close + allow "Demo zurücksetzen"
    document.body.addEventListener("click", (e)=>{
      const resetBtn = e.target.closest ? e.target.closest("#btn-reset-demo") : null;
      if(resetBtn){
        resetDemo();
        return;
      }
      const a = e.target.closest ? e.target.closest("a[data-close]") : null;
      if(a) closeModal();
    });
  }

  // Boot
  initData();
  applyTheme(loadTheme());
  bindGlobal();

  if(!location.hash){
    location.hash = "#/app/start";
  }
  render();
})();