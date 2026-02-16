/* social_order_v0.16.7 · GovConnect Shell + Social Order Demo
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

(function(){
  // mock payload is defined in index.html (window.SOCIAL_ORDER)
  // NOTE: We provide our own local formatting helpers below (eur/dt).
  const { mock } = window.SOCIAL_ORDER;

  const VERSION = "0.16.7";
  const PERSONNEL = (window.SOCIAL_ORDER && window.SOCIAL_ORDER.personnel) ? window.SOCIAL_ORDER.personnel : null;
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

  // Storage-Key + Migration/Repair
  // Historisch wurden die Keys als "social_order_state_v0_15_7" etc gespeichert.
  // v0.16 führt das konsistent fort, bleibt aber tolerant gegenüber Zwischenständen.
  const STORAGE_KEY = `social_order_state_v${VERSION.replaceAll(".","_")}`;
  const STORAGE_KEYS_FALLBACK = [
    // (tolerant) Zwischenstände ohne 'v'-Prefix
    "social_order_state_0_15_9",
    "social_order_state_0_15_8",
    "social_order_state_0_15_7",
    // (standard) v-Prefix
    "social_order_state_v0_15_9",
    "social_order_state_v0_15_8",
    "social_order_state_v0_15_7",
    "social_order_state_v0_15_6",
    "social_order_state_v0_15_5",
    "social_order_state_v0_15_4",
    "social_order_state_v0_15_3",
    "social_order_state_v0_15_2",
    "social_order_state_v0_15_1",
    "social_order_state_v0_15_0",
    "social_order_state_v0_14_0",
    "social_order_state_v0_13_2",
    "social_order_state_v0_13_1",
    "social_order_state_v0_13",
    "social_order_state_v0_12",
    "social_order_state_v0_11",
    "social_order_state_v0_10",
    "social_order_state_v0_9",
    "social_order_state_v0_8",
    "social_order_state_v0_7",
    "social_order_state_v0_6"
  ];
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

  // ---------- Session / Personal ----------
  function defaultUserId(){
    return (LEADERSHIP && (LEADERSHIP.procurementChiefId || LEADERSHIP.mayorId)) || (PEOPLE[0] ? PEOPLE[0].id : null);
  }

  function ensureSession(){
    if(!state.session || typeof state.session !== 'object') state.session = { userId: null };
    if(!state.session.userId) state.session.userId = defaultUserId();
  }

  function getCurrentUserId(){
    ensureSession();
    return state.session.userId;
  }

  // Backwards-compat helper (older code paths may call currentUserId()).
  function currentUserId(){
    return getCurrentUserId();
  }

  function getPersonById(id){
    return PEOPLE.find(p => p && p.id === id) || null;
  }

  function getCurrentUser(){
    const u = getPersonById(getCurrentUserId());
    return u || (PEOPLE[0] || null);
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

  function getRoleList(user){
    const roles = (user && Array.isArray(user.roles)) ? user.roles : [];
    return roles.filter(r => r && typeof r === 'object' && typeof r.key === 'string');
  }

  function hasRoleKey(user, key){
    return getRoleList(user).some(r => r.key === key);
  }

  function findRole(user, key, scopeType){
    return getRoleList(user).find(r => r.key === key && (!scopeType || r.scopeType === scopeType)) || null;
  }

  function permissions(){
    ensureSession();
    const user = getCurrentUser();

    const leadOrg = findRole(user, 'lead', 'org');
    const leadDept = findRole(user, 'lead', 'dept');
    const leadUnit = findRole(user, 'lead', 'unit');
    const approverDept = findRole(user, 'approver', 'dept');
    const isCentral = hasRoleKey(user, 'central');

    const canBatch = Boolean(isCentral);
    // Freigaben sind ausschließlich für die (Fachbereichs-)Freigabe gedacht.
    // Leitung/Zentrale Beschaffung steuern über Dashboard, nicht über „Freigaben“.
    const canApprovals = Boolean(approverDept);
    const canDashboard = Boolean(leadOrg || leadDept || leadUnit || approverDept || isCentral);

    // Dashboard-Tabs: Freigabe bekommt nur "Steuerung" (now)
    const dashboardTabs = (approverDept && !leadOrg && !leadDept && !leadUnit && !isCentral)
      ? ['now']
      : ['now','period','analysis'];

    // Scope fürs harte Filtern (ohne UI) bei Bereichs-/Amtsleitung
    let scope = { type: 'org', deptId: 'all', unitId: 'all', locked: false };
    if(leadOrg || isCentral){
      scope = { type: 'org', deptId: 'all', unitId: 'all', locked: false };
    } else if(leadDept){
      scope = { type: 'dept', deptId: String(leadDept.scopeId), unitId: 'all', locked: true };
    } else if(approverDept){
      scope = { type: 'dept', deptId: String(approverDept.scopeId), unitId: 'all', locked: true };
    } else if(leadUnit){
      scope = { type: 'unit', deptId: 'all', unitId: String(leadUnit.scopeId), locked: true };
    } else {
      const uUnit = (user && user.unitId) ? String(user.unitId) : 'all';
      scope = { type: 'self', deptId: 'all', unitId: uUnit, locked: true };
    }

    // Scope für Freigaben
    let approvalsScope = { deptId: 'none', unitId: 'none' };
    if(leadOrg || isCentral){
      approvalsScope = { deptId: 'all', unitId: 'all' };
    } else if(approverDept){
      approvalsScope = { deptId: String(approverDept.scopeId), unitId: 'all' };
    }

    const userId = getCurrentUserId();

    const roles = new Set(["user"]);
    if(isCentral) roles.add("central");
    if(approverDept) roles.add("approver");
    if(leadOrg || leadDept || leadUnit || isCentral) roles.add("lead");

    let roleLabel = "Mitarbeitende";
    if(isCentral) roleLabel = "Zentrale Beschaffung";
    else if(approverDept) roleLabel = "Freigabe";
    else if(leadOrg || leadDept || leadUnit) roleLabel = "Leitung";

    return { user, userId, roles: Array.from(roles), roleLabel, leadOrg, leadDept, leadUnit, approverDept, isCentral, canBatch, canApprovals, canDashboard, scope, approvalsScope, dashboardTabs };
  }

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

// ---------- Storage ----------
  function loadState(){
    try{
      let raw = null;
      try{ raw = localStorage.getItem(STORAGE_KEY); }catch(_){ raw = null; }

      if(!raw){
        for(const k of STORAGE_KEYS_FALLBACK){
          try{ raw = localStorage.getItem(k); }catch(_){ raw = null; }
          if(raw) break;
        }
      }
      if(!raw) return false;

      const s = JSON.parse(raw);
      if(!s || !Array.isArray(s.orders)) return false;

      state.orders = s.orders;
      state.historyOrders = Array.isArray(s.historyOrders) ? s.historyOrders : [];

      state.session = (s.session && typeof s.session === "object") ? s.session : state.session;
      ensureSession();

      // Catalog: if old schema (no group field), use current mock catalog
      const catOk = Array.isArray(s.catalog) && s.catalog.length > 0 && s.catalog.every(it => it && typeof it === "object" && ("group" in it));
      state.catalog = catOk ? s.catalog : deepClone(mock.catalog);

      // Activities (optional in older versions)
      state.activities = Array.isArray(s.activities) ? s.activities : [];

      // UI: merge (keeps defaults for new fields)
      state.ui = Object.assign({}, state.ui, (s.ui || {}));

      // Ensure org context exists (GovConnect shell framing)
      if(!state.ui.orgContext) state.ui.orgContext = "city";

      // Ensure activitySeenAt exists (migration safety)      // activitySeenAt: ab v0.16.0 pro User-ID (nicht mehr pro Rolle)
      const seen = (s.ui && s.ui.activitySeenAtByUser && typeof s.ui.activitySeenAtByUser === 'object')
        ? s.ui.activitySeenAtByUser
        : ((s.ui && s.ui.activitySeenAt && typeof s.ui.activitySeenAt === 'object') ? s.ui.activitySeenAt : null);
      if(seen && (('user' in seen) || ('approver' in seen) || ('central' in seen) || ('lead' in seen))){
        state.ui.activitySeenAtByUser = {};
      } else if(seen){
        state.ui.activitySeenAtByUser = seen;
      } else {
        state.ui.activitySeenAtByUser = {};
      }

      // Ensure poSeq exists
      if(typeof state.ui.poSeq !== "number") state.ui.poSeq = 2001;

      return true;
    }catch(_){
      return false;
    }
  }

  function saveState(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        session: state.session,
        orders: state.orders,
        historyOrders: state.historyOrders,
        catalog: state.catalog,
        activities: state.activities,
        ui: state.ui
      }));
    }catch(_){}
  }

  function resetDemo(){
    try{
      localStorage.removeItem(STORAGE_KEY);
      for(const k of (STORAGE_KEYS_FALLBACK || [])){
        try{ localStorage.removeItem(k); }catch(_){ }
      }
    }catch(_){ }
    // Theme bleibt bewusst erhalten (THEME_KEY)
    location.reload();
  }

  function seedActivitiesFromOrders(){
    if(state.activities && state.activities.length) return;

    // Create a compact initial feed from latest audit entry of each order
    const acts = [];
    for(const o of (state.orders || [])){

      const last = (o.audit && o.audit.length) ? o.audit[o.audit.length - 1] : null;
      if(last){
        acts.push({
          id: `act_${Math.random().toString(36).slice(2)}_${Date.now()}`,
          at: last.at,
          text: `${o.id}: ${last.what}`,
          orderId: o.id,
          audience: ["all"]
        });
      }else{
        acts.push({
          id: `act_${Math.random().toString(36).slice(2)}_${Date.now()}`,
          at: o.createdAt || nowIso(),
          text: `${o.id}: Anforderung im System`,
          orderId: o.id,
          audience: ["all"]
        });
      }
    }
    // Newest first
    acts.sort((a,b)=> new Date(b.at) - new Date(a.at));
    state.activities = acts.slice(0, 20);

    // Mark everything as seen for all Testpersonen at first load (prevents huge red badge)
    const latest = state.activities.length ? state.activities[0].at : nowIso();
    // Ab v0.16.0: Seen pro Testperson (User-ID)
    state.ui.activitySeenAtByUser = {};
    for(const p of (PEOPLE || [])){
      state.ui.activitySeenAtByUser[p.id] = latest;
    }
  }

  function initData(){
    ensureSession();
    const ok = loadState();
    if(!ok){
      state.catalog = deepClone(mock.catalog);
      state.orders = deepClone(mock.orders);
      state.historyOrders = deepClone(mock.historyOrders || []);
      state.activities = [];
      seedActivitiesFromOrders();
      saveState();
    }else{
      // If upgrading from v0.3 (no feed), seed once
      seedActivitiesFromOrders();

      // v0.11: Ensure dashboard history exists (12 Monate Simulationsdaten)
      if(!Array.isArray(state.historyOrders) || state.historyOrders.length === 0){
        state.historyOrders = deepClone(mock.historyOrders || []);
      }

      saveState();
    }

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

  // ---------- Routing / Role ----------
  function canAccess(route){
    const caps = permissions();
    if(route.startsWith("/app/approvals")) return caps.canApprovals;
    if(route.startsWith("/app/batch")) return caps.canBatch;
    if(route.startsWith("/app/dashboard")) return caps.canDashboard;
    return true;
  }

  function applyRoleVisibility(){
    const caps = permissions();
    document.querySelectorAll("[data-role]").forEach(el=>{
      const need = el.getAttribute("data-role");
      let show = true;
      if(need === "approver") show = caps.canApprovals;
      if(need === "central") show = caps.canBatch;
      if(need === "lead") show = caps.canDashboard;
      el.style.display = show ? "" : "none";
    });
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

  function setActiveNav(route){
    // Topnav
    document.querySelectorAll(".topnav__item").forEach(a=>{
      a.classList.toggle("is-active", a.getAttribute("data-route") === route);
    });

    // Sidebar Sub-Items (Social Order)
    document.querySelectorAll(".sidebar__subItem").forEach(a=>{
      a.classList.toggle("is-active", a.getAttribute("data-route") === route);
    });
  }

  function routeFromHash(){
    const h = (location.hash || "#/app/start").replace(/^#/, "");
    if(!h.startsWith("/")) return "/app/start";
    return h;
  }

  function navTo(route){
    if(!canAccess(route)){
      const caps = permissions();
      if(caps.canDashboard) return location.hash = "#/app/dashboard";
      if(caps.canBatch) return location.hash = "#/app/batch";
      if(caps.canApprovals) return location.hash = "#/app/approvals";
      return location.hash = "#/app/start";
    }
    location.hash = "#" + route;
  }

  // ---------- Utilities ----------
  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll("\"","&quot;")
      .replaceAll("'","&#39;");
  }

  function eur(n){
    const val = Number(n);
    const safe = Number.isFinite(val) ? val : 0;
    try {
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(safe);
    } catch (e) {
      // Fallback if Intl is unavailable
      return safe.toFixed(2).replace('.', ',') + ' €';
    }
  }

  function dt(ts){
    if(!ts) return '–';
    const d = (ts instanceof Date) ? ts : new Date(ts);
    if(Number.isNaN(d.getTime())) return '–';
    try {
      return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
    } catch (e) {
      return d.toLocaleString();
    }
  }

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

  function costCenterLabel(code){
    const c = COSTCENTER_BY_CODE[String(code||"")];
    if(!c) return code ? String(code) : "–";
    return c.name ? `${c.code} · ${c.name}` : c.code;
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

  function orderTotal(order){
    return (order.items || []).reduce((sum, it)=> sum + (Number(it.price) * Number(it.qty || 0)), 0);
  }

  function orderVendors(order){
    return Array.from(new Set((order.items || []).map(it => it.vendor).filter(Boolean)));
  }

  function orderContracts(order){
    return Array.from(new Set((order.items || []).map(it => it.contract).filter(Boolean)));
  }

  function orderVendor(order){
    const vs = orderVendors(order);
    return vs.length ? vs[0] : "–";
  }

  function orderContract(order){
    const cs = orderContracts(order);
    return cs.length ? cs[0] : "";
  }

  // Short label for tables, e.g. "OfficePro + 2"
  function vendorsLabel(order){
    const vs = orderVendors(order);
    if(!vs.length) return "–";
    if(vs.length === 1) return vs[0];
    return `${vs[0]} + ${vs.length - 1}`;
  }

  function vendorsFullLabel(order){
    const vs = orderVendors(order);
    return vs.length ? vs.join(", ") : "–";
  }

  // Full label for contracts, e.g. "Rahmenvertrag 1, Rahmenvertrag 2"
  // (Used in detail views; keep as helper for backwards compatibility.)
  function contractsFullLabel(order){
    const cs = orderContracts(order);
    return cs.length ? cs.join(", ") : "";
  }

  function splitParts(order){
    const p = order && (order.splits || order.subOrders || order.parts);
    return Array.isArray(p) ? p : [];
  }

  function aggregateStatus(order){
    const parts = splitParts(order);
    if(!parts.length) return order.status;
    const statuses = parts.map(p=>p.status).filter(Boolean);
    const uniq = Array.from(new Set(statuses));
    if(!uniq.length) return order.status;
    if(uniq.length === 1) return uniq[0];
    if(uniq.includes("Abgeschlossen")) return "Teilweise abgeschlossen";
    if(uniq.includes("Bestellt")) return "Teilweise bestellt";
    if(uniq.includes("Im Bestelllauf")) return "Teilweise im Bestelllauf";
    return "In Bearbeitung";
  }

  function syncAggregate(order){
    if(!order) return;
    if(splitParts(order).length){
      order.status = aggregateStatus(order);
    }
  }

  function statusCategory(status){
    if(!status) return "open";
    if(String(status).startsWith("Teilweise")) return "open";
    if(status === "In Freigabe" || status === "Rückfrage") return "approval";
    if(status === "Abgeschlossen" || status === "Abgelehnt") return "done";
    return "open";
  }

  function statusTag(status){
    const cat = statusCategory(status);
    const cls =
      (status === "Rückfrage") ? "status status--question"
      : (cat === "approval") ? "status status--approval"
      : (cat === "done") ? (status === "Abgelehnt" ? "status status--rejected" : "status status--done")
      : "status status--open";
    return `<span class="${cls}">${escapeHtml(status)}</span>`;
  }

  function countByCategory(cat, list){
    const arr = Array.isArray(list) ? list : state.orders;
    return arr.filter(o => statusCategory(o.status) === cat).length;
  }

  function orderGateReason(order){
    if(order && order.gateReason) return String(order.gateReason);

    const threshold = Number(mock.meta.gateThreshold || 25);
    const total = orderTotal(order);

    const hasSpecial = (order.items || []).some(it => {
      const c = state.catalog.find(x => x.id === it.id);
      return c && c.special;
    });

    if(hasSpecial) return "Sonderbedarf";
    if(order.exceptionText) return "Sonderbedarf (Begründung)";
    if(total >= threshold) return `Summe ≥ ${threshold} €`;
    if(order.urgency === "urgent") return "Dringlichkeit: dringend";
    return "Gate-Regel";
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
    mountPeopleTabs();
    mountPeopleDirectory();
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

  // ------------------------------------------------------------
  // Shell: Personenverzeichnis (Mock)
  // - Pagination + Filter nach Amt/Einheit
  // - Wenn ein Amt gefiltert wird, erscheint darüber automatisch
  //   die Fachbereichsleitung (und optional Bürgermeister) –
  //   wie in der Aufgabenlogik beschrieben.
  // ------------------------------------------------------------

  function mountPeopleTabs(){
    const wrap = document.getElementById("people-panels");
    if(!wrap) return;

    const btns = Array.from(document.querySelectorAll("[data-people-tab]"));
    const panels = Array.from(wrap.querySelectorAll("[data-people-panel]"));

    function setTab(key){
      btns.forEach(b=> b.classList.toggle("chip--active", b.getAttribute("data-people-tab") === key));
      panels.forEach(p=> p.classList.toggle("is-active", p.getAttribute("data-people-panel") === key));
    }

    btns.forEach(b=>{
      b.addEventListener("click", ()=>{
        const key = b.getAttribute("data-people-tab") || "directory";
        setTab(key);
      });
    });

    setTab("directory");
  }

  function statusBadge(s){
    const st = String(s||"").toLowerCase();
    if(st === "online") return { dot:"dot dot--green", label:"Online" };
    if(st === "meeting" || st === "termin") return { dot:"dot dot--blue", label:"Im Termin" };
    if(st === "reachable" || st === "erreichbar") return { dot:"dot dot--violet", label:"Erreichbar" };
    return { dot:"dot", label:"Abwesend" };
  }

  function mountPeopleDirectory(){
    const grid = document.getElementById("people-grid");
    if(!grid) return;

    const search = document.getElementById("people-search");
    const sel = document.getElementById("people-filter-unit");
    const prev = document.getElementById("people-prev");
    const next = document.getElementById("people-next");
    const info = document.getElementById("people-pageinfo");
    const countEl = document.getElementById("people-count");

    const rawPeople = Array.isArray(PEOPLE) && PEOPLE.length ? PEOPLE : [];
    if(!rawPeople.length){
      grid.innerHTML = `<div class="callout"><div class="callout__title">Keine Personaldaten</div><div class="callout__text">assets/js/personnel.js liefert keine Personen. (Demo)</div></div>`;
      return;
    }

    const people = rawPeople.map(p=>({
      id: p.id,
      name: p.name,
      initials: p.initials,
      unit: p.unitId ? String(p.unitId) : "",
      unitLabel: p.unitLabel || (p.unitId ? String(p.unitId) : "–"),
      status: p.presence || "",
      title: p.title || "",
    }));

    // Leader-Container dynamisch über dem Grid einfügen
    let leadersEl = document.getElementById("people-leaders");
    if(!leadersEl && grid.parentElement){
      leadersEl = document.createElement("div");
      leadersEl.id = "people-leaders";
      leadersEl.className = "peopleLeaders";
      grid.parentElement.insertBefore(leadersEl, grid);
    }

    const perPage = 10;
    let page = 1;
    let unit = "all";
    let q = "";

    // Dropdown befüllen
    if(sel){
      const opts = [{ value:"all", label:"Alle" }];
      for(const u of ORG_UNITS){
        opts.push({ value: u.id, label: formatOrgUnit(u) });
      }
      opts.push({ value:"ZB", label:"Zentrale Beschaffung" });
      opts.push({ value:"IT", label:"IT‑Service" });
      sel.innerHTML = opts.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join("");
      sel.value = "all";
      sel.addEventListener("change", ()=>{
        unit = sel.value || "all";
        page = 1;
        render();
      });
    }

    if(search){
      search.addEventListener("input", ()=>{
        q = String(search.value || "").trim().toLowerCase();
        page = 1;
        render();
      });
    }

    function filtered(){
      const qq = q;
      const excludeIds = new Set();

      // In der Amtsansicht: Leitung nicht doppelt in der Mitarbeitenden-Liste anzeigen
      if(unit !== "all"){
        const unitLeads = (LEADERSHIP && LEADERSHIP.unitLeads) ? LEADERSHIP.unitLeads : {};
        const unitLead = unitLeads[unit];
        if(unitLead && unitLead.id) excludeIds.add(String(unitLead.id));

        if(String(unit) === "ZB" && LEADERSHIP && LEADERSHIP.procurementChief && LEADERSHIP.procurementChief.id){
          excludeIds.add(String(LEADERSHIP.procurementChief.id));
        }
      }

      return people.filter(p => {
        if(excludeIds.has(String(p.id))) return false;
        if(unit !== "all" && p.unit !== unit) return false;
        if(!qq) return true;
        const hay = `${p.name} ${p.unitLabel} ${p.title}`.toLowerCase();
        return hay.includes(qq);
      });
    }


    function leaderCard(person, roleLabel){
      const st = statusBadge(person && person.presence);
      const unitLabel = person && person.unitLabel ? person.unitLabel : "–";
      return `
        <div class="personCard personCard--leader" data-person-id="${escapeHtml(person.id)}">
          <div class="personCard__avatar">${escapeHtml(person.initials || "SO")}</div>
          <div class="personCard__main">
            <div class="personCard__name">${escapeHtml(person.name)}</div>
            <div class="personCard__meta">${escapeHtml(roleLabel)} · ${escapeHtml(unitLabel)}</div>
          </div>
          <div class="personCard__right">
            <div class="personCard__status"><span class="${st.dot}"></span> ${escapeHtml(st.label)}</div>
          </div>
        </div>
      `;
    }

    function renderLeaders(){
      const unit = sel.value;
      if (unit === "all") {
        leadersEl.innerHTML = "";
        leadersEl.style.display = "none";
        return;
      }

      // IT-Service: in der Demo keine gesonderte Leitungszeile
      if (String(unit) === "IT") {
        leadersEl.innerHTML = "";
        leadersEl.style.display = "none";
        return;
      }

      const deptLeadByDeptId = LEADERSHIP.deptLeads || {};
      const unitLeadByUnitId = LEADERSHIP.unitLeads || {};

      const unitLabel = (ORG_UNIT_BY_ID[String(unit)] || (PERSONNEL.unitById ? PERSONNEL.unitById[String(unit)] : null) || {}).label || "";

      const cards = [];
      const seen = new Set();

      const pushCard = (person, subtitle) => {
        if (!person || !person.id || seen.has(person.id)) return;
        seen.add(person.id);
        cards.push(personCard({
          name: person.name,
          initials: person.initials,
          status: person.presence || "online",
          subtitle
        }));
      };

      if (String(unit) === "ZB") {
        // Zentrale Beschaffung: nur Boris als Leitung (ohne Bürgermeisterin/Fachbereich)
        const chief = LEADERSHIP.procurementChief;
        if (chief) pushCard(chief, "Leitung" + (unitLabel ? " · " + unitLabel : ""));
      } else {
        // find dept for unit
        const dept = (ORG_MODEL.depts || []).find(d => (d.units || []).some(u => String(u.id) === String(unit)));
        const deptLead = dept ? deptLeadByDeptId[dept.id] : null;
        const unitLead = unitLeadByUnitId[unit];

        if (deptLead) {
          const deptLabel = dept && dept.label ? String(dept.label) : "";
          pushCard(deptLead, "Fachbereichsleitung" + (deptLabel ? " · " + deptLabel : ""));
        }
        if (unitLead) {
          pushCard(unitLead, "Amtsleitung" + (unitLabel ? " · " + unitLabel : ""));
        }
      }

      if (cards.length) {
        leadersEl.style.display = "block";
        leadersEl.innerHTML = `<div class="muted mb-8">Leitung</div><div class="peopleLeaders">${cards.join("")}</div>`;
      } else {
        leadersEl.innerHTML = "";
        leadersEl.style.display = "none";
      }
    }

    function render(){
      // Ensure filter state follows the select (robust against stale closure state).
      if(sel){
        unit = sel.value || "all";
      }

      renderLeaders();

      const list = filtered();
      const pages = Math.max(1, Math.ceil(list.length / perPage));
      page = Math.min(Math.max(1, page), pages);

      const start = (page - 1) * perPage;
      const slice = list.slice(start, start + perPage);

      grid.innerHTML = slice.map(p => {
        const st = statusBadge(p.status);
        return `
          <div class="personCard" data-person-id="${escapeHtml(p.id)}">
            <div class="personCard__avatar">${escapeHtml(p.initials)}</div>
            <div class="personCard__main">
              <div class="personCard__name">${escapeHtml(p.name)}</div>
              <div class="personCard__meta">${escapeHtml(p.unitLabel)}${p.title ? " · " + escapeHtml(p.title) : ""}</div>
            </div>
            <div class="personCard__right">
              <div class="personCard__status"><span class="${st.dot}"></span> ${escapeHtml(st.label)}</div>
              <div class="personCard__actions" aria-label="Aktionen">
                <button class="icon-btn icon-btn--sm" type="button" data-person-action="chat" title="Chat"><span class="icon icon--chat"></span></button>
                <button class="icon-btn icon-btn--sm" type="button" data-person-action="call" title="Anruf"><span class="icon icon--phone"></span></button>
                <button class="icon-btn icon-btn--sm" type="button" data-person-action="video" title="Video"><span class="icon icon--video"></span></button>
              </div>
            </div>
          </div>
        `;
      }).join("");

      if(info) info.textContent = `Seite ${page} / ${pages}`;
      if(prev) prev.disabled = page <= 1;
      if(next) next.disabled = page >= pages;
      if(countEl){
        const total = people.length;
        countEl.textContent = `Angezeigt: ${slice.length} von ${list.length} (gesamt: ${total}).`;
      }
    }

    if(prev) prev.addEventListener("click", ()=>{ if(page > 1){ page--; render(); } });
    if(next) next.addEventListener("click", ()=>{ if(page < 999){ page++; render(); } });

    // Action buttons (nur Demo)
    grid.addEventListener("click", (ev)=>{
      const btn = ev.target.closest("[data-person-action]");
      if(!btn) return;
      const action = btn.getAttribute("data-person-action") || "";
      const card = btn.closest(".personCard");
      const pid = card ? card.getAttribute("data-person-id") : "";
      const person = personById(pid);
      const who = person ? person.name : "Person";

      const title = action === "chat" ? "Chat" : (action === "call" ? "Anruf" : "Videocall");
      openModal(`
        <div class="callout">
          <div class="callout__title">Nur Darstellung</div>
          <div class="callout__text">${escapeHtml(title)} ist in dieser Demo bewusst nicht implementiert (Shell‑Rahmen). Interaktiv ist die App <strong>Social Order</strong>.</div>
        </div>
      `, { title: `${title} · ${who}` });
    });

    render();
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

  function render(){
    const route = routeFromHash();
    // normalize some routes
    const normalized = (route === "/app" || route === "/app/") ? "/app/start" : route;
    if(!canAccess(normalized)){
      navTo("/app/start");
      return;
    }

    // shell vs. app context
    document.body.classList.toggle("is-in-app", normalized.startsWith("/app"));

    setActiveNav(normalized);

    let handled = true;
    if(normalized === "/home") renderShellHome();
    else if(normalized === "/chronik") renderChronik();
    else if(normalized === "/personen") renderShellPersonen();
    else if(normalized === "/bereiche") renderShellBereiche();
    else if(normalized === "/dokumente") renderShellDokumente();
    else if(normalized === "/apps") renderShellApps();

    // legacy placeholders (nicht Teil der Shell-Navigation in v0.15.x)
    else if(normalized === "/chats") renderPlaceholder("Chats");
    else if(normalized === "/kalender") renderPlaceholder("Kalender");
    else if(normalized === "/feed") renderPlaceholder("Neuigkeiten");
    else if(normalized === "/newsroom") renderPlaceholder("Newsroom");
    else if(normalized === "/gruppen") renderPlaceholder("Gruppen");
    else if(normalized === "/projekte") renderPlaceholder("Projekte");

    else if(normalized === "/about"){
      els.content.innerHTML = tpl("tpl-about");
    }

    else if(normalized === "/app/start"){
      els.content.innerHTML = tpl("tpl-app-start");
      renderStartKpis();
    }

    else if(normalized === "/app/new"){
      els.content.innerHTML = tpl("tpl-app-new");
      mountNewOrder();
    }

    else if(normalized === "/app/orders"){
      els.content.innerHTML = tpl("tpl-app-orders");
      mountOrders();
    }

    else if(normalized === "/app/approvals"){
      els.content.innerHTML = tpl("tpl-app-approvals");
      mountApprovals();
    }

    else if(normalized === "/app/batch"){
      els.content.innerHTML = tpl("tpl-app-batch");
      mountBatch();
    }

    else if(normalized === "/app/dashboard"){
      els.content.innerHTML = tpl("tpl-app-dashboard");
      mountDashboard();
    }

    else {
      handled = false;
    }

    if(!handled){
      navTo("/app/start");
      return;
    }

    // post-render: apply visibility and global demo framing
    applyRoleVisibility();
    updateActivityBadge();
    applyOrgContext();
  }

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
  // Guard
  const panelNow = document.getElementById("dash-panel-now");
  const panelPeriod = document.getElementById("dash-panel-period");
  const panelAnalysis = document.getElementById("dash-panel-analysis");
  if(!panelNow || !panelPeriod) return;

  const tabButtons = Array.from(document.querySelectorAll("[data-dash-tab]"));
  const rangeLabel = document.getElementById("dash-range-label");

  const presetWrap = document.getElementById("dash-presets");
  const deptEl = document.getElementById("dash-dept");
  const unitEl = document.getElementById("dash-unit");
  const fromEl = document.getElementById("dash-from");
  const toEl = document.getElementById("dash-to");
  const btnApply = document.getElementById("dash-apply");

  // v0.16.0: Org-Filter für Bereichs-/Amtsleitung hart setzen und UI ausblenden
  const caps = permissions();

  // v0.16: Dashboard-Tabs nach Rolle einschränken (z.B. reine Freigabe → nur "Steuerung")
  const allowedTabs = (caps.dashboardTabs && Array.isArray(caps.dashboardTabs) && caps.dashboardTabs.length)
    ? caps.dashboardTabs
    : ["now","period","analysis"];
  tabButtons.forEach(btn=>{
    const k = btn.getAttribute('data-dash-tab');
    const show = allowedTabs.includes(k);
    btn.style.display = show ? '' : 'none';
  });
  if(!allowedTabs.includes(state.ui.dashboardTab || 'now')){
    state.ui.dashboardTab = allowedTabs[0] || 'now';
    saveState();
  }
  if(caps.scope && caps.scope.locked){
    if(caps.scope.type === 'dept'){
      state.ui.dashboardDept = caps.scope.deptId;
      state.ui.dashboardUnit = 'all';
    } else if(caps.scope.type === 'unit'){
      const u = ORG_BY_ID[caps.scope.unitId];
      state.ui.dashboardDept = u ? u.deptId : 'all';
      state.ui.dashboardUnit = caps.scope.unitId;
    }

    // UI ausblenden (nur Org-Filter, Zeitraum bleibt)
    if(deptEl){
      const wrap = deptEl.closest('.dashField');
      if(wrap) wrap.style.display = 'none';
      deptEl.disabled = true;
    }
    if(unitEl){
      const wrap = unitEl.closest('.dashField');
      if(wrap) wrap.style.display = 'none';
      unitEl.disabled = true;
    }
    saveState();
  }

  const nowFilterLabel = document.getElementById("dash-now-filterLabel");
  const mixDimWrap = document.getElementById("dash-mix-dim");
  const mixMetricWrap = document.getElementById("dash-mix-metric");
  const mixTitleEl = document.getElementById("dash-per-mixTitle");

  // Analyse
  const anaMetricWrap = document.getElementById("dash-ana-metric");
  const anaContext = document.getElementById("dash-ana-context");
  const anaTopOrgs = document.getElementById("dash-ana-topOrgs");
  const anaTopCosts = document.getElementById("dash-ana-topCosts");
  const anaTopOrgsHint = document.getElementById("dash-ana-topOrgsHint");
  const anaTopCostsHint = document.getElementById("dash-ana-topCostsHint");
  const anaJumpFilters = document.getElementById("dash-ana-jumpFilters");

  // v0.15: Cache the latest analysis calculation for drilldown
  let analysisCache = null;

  // -------- helpers --------
  function ymdLocal(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }

  function parseYmdLocal(s){
    // s: YYYY-MM-DD (from <input type="date">)
    if(!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y,m,d] = s.split("-").map(n=>Number(n));
    const dt = new Date(y, (m-1), d, 12, 0, 0, 0); // midday to avoid DST edge
    return dt;
  }

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function dec(n, digits){
    const d = (typeof digits === "number") ? digits : 1;
    const val = Number(n);
    if(!Number.isFinite(val)) return "–";
    try {
      return new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }).format(val);
    } catch (e) {
      return val.toFixed(d).replace('.', ',');
    }
  }

  function selectedOrgFilter(){
    const dept = String(state.ui.dashboardDept || "all");
    const unit = String(state.ui.dashboardUnit || "all");
    return { dept, unit };
  }

  function deptById(id){
    const deps = (ORG_MODEL && Array.isArray(ORG_MODEL.departments)) ? ORG_MODEL.departments : [];
    return deps.find(d => String(d.id) === String(id)) || null;
  }

  function orgFilterLabel(){
    const f = selectedOrgFilter();
    if(f.dept === "all" && f.unit === "all") return "Alle";
    if(f.unit !== "all"){
      const u = ORG_BY_ID[f.unit];
      if(u) return `${u.deptName} · ${formatOrgUnit(u)}`;
      return "Amt";
    }
    if(f.dept !== "all"){
      const d = deptById(f.dept);
      return d ? d.name : "Fachbereich";
    }
    return "Alle";
  }

  function orderMatchesOrg(order){
    const f = selectedOrgFilter();
    if(f.dept === "all" && f.unit === "all") return true;
    const u = orderOrgUnit(order);
    if(!u) return false;
    if(f.unit !== "all") return String(u.id) === f.unit;
    if(f.dept !== "all") return String(u.deptId) === f.dept;
    return true;
  }

  function partMatchesOrg(part){
    const f = selectedOrgFilter();
    if(f.dept === "all" && f.unit === "all") return true;
    if(!part) return false;
    if(f.unit !== "all") return String(part.orgId || "") === f.unit;
    if(f.dept !== "all") return String(part.deptId || "") === f.dept;
    return true;
  }

  function setSegmentedActive(wrap, attr, active){
    if(!wrap) return;
    wrap.querySelectorAll(`[data-${attr}]`).forEach(b=>{
      const isActive = b.getAttribute(`data-${attr}`) === active;
      b.classList.toggle("is-active", isActive);
    });
  }

  function updateOrgSelects(){
    if(!deptEl || !unitEl || !ORG_MODEL) return;

    const deps = Array.isArray(ORG_MODEL.departments) ? ORG_MODEL.departments : [];

    // Fachbereich
    deptEl.innerHTML = [
      `<option value="all">Alle</option>`,
      ...deps.map(d=> `<option value="${escapeHtml(String(d.id))}">${escapeHtml(String(d.name))}</option>`)
    ].join("");

    const f = selectedOrgFilter();
    deptEl.value = (deps.some(d => String(d.id) === f.dept) ? f.dept : "all");

    // Amt (abhängig vom Fachbereich)
    const allowedUnits = (deptEl.value === "all")
      ? ORG_UNITS
      : ORG_UNITS.filter(u => String(u.deptId) === deptEl.value);

    unitEl.innerHTML = [
      `<option value="all">Alle</option>`,
      ...allowedUnits.map(u=> `<option value="${escapeHtml(String(u.id))}">${escapeHtml(formatOrgUnit(u))}</option>`)
    ].join("");

    const unitOk = allowedUnits.some(u => String(u.id) === f.unit);
    unitEl.value = unitOk ? f.unit : "all";

    // Persist korrigierte Auswahl (z.B. wenn Fachbereich gewechselt und Amt nicht mehr passt)
    const nextDept = deptEl.value || "all";
    const nextUnit = unitEl.value || "all";
    if(state.ui.dashboardDept !== nextDept || state.ui.dashboardUnit !== nextUnit){
      state.ui.dashboardDept = nextDept;
      state.ui.dashboardUnit = nextUnit;
      saveState();
    }
  }

  function updateNowFilterLabel(){
    if(!nowFilterLabel) return;
    // v0.15.3: Always show filter status for screenshots/clarity
    nowFilterLabel.textContent = `Filter: ${orgFilterLabel()}`;
  }

  function analyticsOrders(){
    return [].concat(state.historyOrders || [], state.orders || []);
  }

  function latestEventDate(){
    // Anchor for "letzte 30 Tage" etc: use max timestamp in data (createdAt + audit)
    let max = null;
    for(const o of (analyticsOrders())){
      const ds = [];
      if(o.createdAt) ds.push(new Date(o.createdAt));
      if(Array.isArray(o.audit)){
        for(const e of o.audit){
          if(e && e.at) ds.push(new Date(e.at));
        }
      }
      for(const d of ds){
        if(!isNaN(d.getTime())){
          if(!max || d > max) max = d;
        }
      }
    }
    return max || new Date();
  }

  function inRange(d, start, end){
    if(!d) return false;
    const t = d.getTime();
    return t >= start.getTime() && t <= end.getTime();
  }

  function dayList(start, end){
    const res = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12,0,0,0);
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12,0,0,0);
    while(cur.getTime() <= last.getTime()){
      res.push(ymdLocal(cur));
      cur.setDate(cur.getDate()+1);
    }
    return res;
  }

  function extractPo(what){
    if(!what) return null;
    const m = String(what).match(/Bestellt:\s*(.+?)\s*\((PO-\d{4}-\d{4})\)/);
    if(!m) return null;
    return { vendor: m[1].trim(), poNumber: m[2].trim() };
  }

  function placedAtForPo(order, poNumber){
    if(!order || !poNumber) return null;
    const a = (order.audit || []);
    for(const e of a){
      if(e && e.at && e.what && String(e.what).includes(poNumber)){
        const d = new Date(e.at);
        if(!isNaN(d.getTime())) return d;
      }
    }
    return null;
  }

  function listPlacedParts(){
    const parts = [];
    for(const o of (analyticsOrders())){
      const ou = orderOrgUnit(o);
      const orgId = ou ? String(ou.id) : (o.orgId ? String(o.orgId) : "");
      const deptId = ou ? String(ou.deptId) : "";
      const p = splitParts(o);
      if(!p.length) continue;
      for(const part of p){
        if(!part || !part.poNumber) continue;
        const placedAt = placedAtForPo(o, part.poNumber) || (o.createdAt ? new Date(o.createdAt) : new Date());
        parts.push({
          orderId: o.id,
          orgId,
          deptId,
          costCenter: o && o.costCenter ? String(o.costCenter) : "",
          vendor: part.vendor || orderVendor(o) || "–",
          contract: part.contract || "",
          poNumber: part.poNumber,
          total: Number(part.total || 0),
          placedAt
        });
      }
    }
    return parts;
  }

  function statusCounts(orders){
    const rows = {
      inApproval: 0,
      questions: 0,
      ready: 0,
      inBatch: 0,
      ordered: 0,
      partialDone: 0,
      done: 0
    };
    for(const o of (orders || [])){

      const s = String(o.status || "");
      if(s === "In Freigabe") rows.inApproval += 1;
      if(s === "Rückfrage"){ rows.inApproval += 1; rows.questions += 1; }
      if(s === "Freigegeben") rows.ready += 1;
      if(s === "Im Bestelllauf" || s === "Teilweise im Bestelllauf") rows.inBatch += 1;
      if(s === "Bestellt" || s === "Teilweise bestellt") rows.ordered += 1;
      if(s === "Teilweise abgeschlossen") rows.partialDone += 1;
      if(s === "Abgeschlossen") rows.done += 1;
    }
    return rows;
  }

  function renderBarChart(el, items){
    if(!el) return;
    const max = Math.max(1, ...items.map(x=>Number(x.count)||0));
    el.innerHTML = items.map(it=>{
      const pct = clamp((Number(it.count)||0) / max * 100, 0, 100);
      const color = it.color || "var(--accent)";
      return `
        <div class="barChart__row">
          <div class="barChart__label">${escapeHtml(it.label)}</div>
          <div class="barChart__bar"><div class="barChart__fill" style="width:${pct}%; background:${color};"></div></div>
          <div class="barChart__value">${escapeHtml(String(it.count))}</div>
        </div>
      `;
    }).join("");
  }

  function renderMetricBarChart(el, items, opts){
    if(!el) return;
    const o = opts || {};
    const valueKey = o.valueKey || "value";
    const formatValue = o.formatValue || ((n)=> String(n));

    const max = Math.max(1, ...items.map(x=> Number(x[valueKey]) || 0));
    el.innerHTML = items.map((it, idx)=>{
      const v = Number(it[valueKey]) || 0;
      const pct = clamp(v / max * 100, 0, 100);
      const color = it.color || "var(--accent)";
      const valueTxt = formatValue(v, it);
      const key = (it && it.key != null) ? String(it.key) : "";
      const kind = (it && it.kind) ? String(it.kind) : "";
      const clickable = !!(opts && opts.clickable);
      const rowCls = clickable ? "barChart__row barChart__row--btn is-clickable" : "barChart__row";
      return `
        ${clickable ? `<button type="button" class="${rowCls}" data-kind="${escapeHtml(kind)}" data-key="${escapeHtml(key)}" aria-label="Details öffnen: ${escapeHtml(it.label)}">` : `<div class="${rowCls}">`}
          <div class="barChart__label" title="${escapeHtml(it.label)}">${escapeHtml(it.label)}</div>
          <div class="barChart__bar"><div class="barChart__fill" style="width:${pct}%; background:${color};"></div></div>
          <div class="barChart__value">${escapeHtml(valueTxt)}</div>
        ${clickable ? `</button>` : `</div>`}
      `;
    }).join("");
  }

  function topNWithOther(rows, n){
    const limit = Number(n || 5);
    const all = Array.isArray(rows) ? rows.slice() : [];
    if(all.length <= limit) return all;
    const top = all.slice(0, limit);
    const rest = all.slice(limit);

    const other = {
      key: "other",
      label: "Sonstige",
      value: rest.reduce((s,r)=> s + (Number(r.value)||0), 0),
      count: rest.reduce((s,r)=> s + (Number(r.count)||0), 0),
      // v0.15: Preserve membership so "Sonstige" is drilldown-capable.
      members: rest.map(r => r && r.key ? String(r.key) : "").filter(Boolean)
    };
    return top.concat(other);
  }

  function renderDonut(el, legendEl, agg, opts){
    if(!el || !legendEl) return;

    const o = opts || {};
    const metric = (o.metric === "count") ? "count" : "value";

    const entries = Object.entries(agg || {}).map(([name, obj])=>({
      name,
      value: Number(obj.value || 0),
      poCount: (obj.pos ? obj.pos.size : 0)
    })).filter(x=>{
      if(metric === "count") return x.poCount > 0;
      return x.value > 0;
    });

    const valOf = (e)=> metric === "count" ? e.poCount : e.value;

    entries.sort((a,b)=> valOf(b) - valOf(a));

    const total = entries.reduce((s,x)=> s + valOf(x), 0);

    if(total <= 0){
      el.style.background = "var(--ui-bg)";
      legendEl.innerHTML = `<div class="muted">Keine Bestellungen im Zeitraum.</div>`;
      return;
    }

    const colors = ["var(--accent)", "var(--accent2)", "var(--violet)", "var(--warn)"];

    let acc = 0;
    const stops = entries.map((e, idx)=>{
      const p = (valOf(e) / total) * 100;
      const from = acc;
      acc += p;
      const to = acc;
      return { e, color: colors[idx % colors.length], from, to };
    });

    const gradient = `conic-gradient(${stops.map(s=> `${s.color} ${s.from.toFixed(2)}% ${s.to.toFixed(2)}%`).join(", ")})`;
    el.style.background = gradient;

    legendEl.innerHTML = stops.map(s=>{
      const pct = (valOf(s.e) / total) * 100;
      const meta = (metric === "count")
        ? `${s.e.poCount} PO(s) · ${escapeHtml(util.eur(s.e.value))} · ${pct.toFixed(0)}%`
        : `${escapeHtml(util.eur(s.e.value))} · ${s.e.poCount} PO(s) · ${pct.toFixed(0)}%`;
      return `
        <div class="donutLegend__row">
          <div class="donutLegend__dot" style="background:${s.color};"></div>
          <div class="donutLegend__main">
            <div class="donutLegend__name">${escapeHtml(s.e.name)}</div>
            <div class="donutLegend__meta">${meta}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderTrendBars(el, start, end, parts){
    if(!el) return { mode: "none" };

    const msDay = 24*60*60*1000;
    const startMid = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12,0,0,0);
    const endMid = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12,0,0,0);
    const totalDays = Math.max(1, Math.floor((endMid.getTime() - startMid.getTime()) / msDay) + 1);

    let mode = "day"; // day | week | month
    if(totalDays > 31 && totalDays <= 180) mode = "week";
    if(totalDays > 180) mode = "month";

    const ddmm = (d)=>{
      const k = (d instanceof Date) ? ymdLocal(d) : String(d||"");
      const p = k.split("-");
      return p.length === 3 ? `${p[2]}.${p[1]}` : k;
    };
    const monthLabel = (ym)=>{
      const p = String(ym).split("-");
      if(p.length !== 2) return String(ym);
      return `${p[1]}.${p[0]}`;
    };

    // Build buckets
    let keys = [];
    const map = {};

    if(mode === "day"){
      keys = dayList(startMid, endMid);
      for(const k of keys) map[k] = 0;

      for(const p of (parts || [])){
        const key = ymdLocal(p.placedAt);
        if(key in map){
          map[key] = Number((map[key] + (Number(p.total)||0)).toFixed(2));
        }
      }
    }else if(mode === "week"){
      const bucketCount = Math.ceil(totalDays / 7);
      for(let i=0;i<bucketCount;i++){
        const d = new Date(startMid);
        d.setDate(d.getDate() + i*7);
        const k = ymdLocal(d);
        keys.push(k);
        map[k] = 0;
      }
      for(const p of (parts || [])){
        const d = new Date(p.placedAt);
        if(isNaN(d.getTime())) continue;
        const mid = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12,0,0,0);
        const delta = Math.floor((mid.getTime() - startMid.getTime())/msDay);
        const idx = Math.floor(delta/7);
        if(idx >= 0 && idx < keys.length){
          const k = keys[idx];
          map[k] = Number((map[k] + (Number(p.total)||0)).toFixed(2));
        }
      }
    }else{
      const keyOf = (d)=> `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      // list months
      let cur = new Date(startMid.getFullYear(), startMid.getMonth(), 1, 12,0,0,0);
      const last = new Date(endMid.getFullYear(), endMid.getMonth(), 1, 12,0,0,0);
      while(cur.getTime() <= last.getTime()){
        const k = keyOf(cur);
        keys.push(k);
        map[k] = 0;
        cur.setMonth(cur.getMonth()+1);
      }
      for(const p of (parts || [])){
        const d = new Date(p.placedAt);
        if(isNaN(d.getTime())) continue;
        const k = keyOf(d);
        if(k in map){
          map[k] = Number((map[k] + (Number(p.total)||0)).toFixed(2));
        }
      }
    }

    const values = keys.map(k=> ({ key:k, value: map[k] || 0 }));
    const max = Math.max(0, ...values.map(v=>v.value));

    if(max <= 0){
      el.innerHTML = `<div class="muted">Noch keine Bestellungen im Zeitraum.</div>`;
      return { mode };
    }

    // SVG dimensions
    const W = 320;
    const H = 160;
    const padL = 34;
    const padR = 10;
    const padT = 12;
    const padB = 26;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const n = values.length;
    const step = n > 0 ? (innerW / n) : innerW;
    const gap = 2;
    const barW = Math.max(1, step - gap);
    const baseY = padT + innerH;

    const rects = values.map((v,i)=>{
      const h = (v.value/max) * innerH;
      const x = padL + i*step + gap/2;
      const y = baseY - h;
      const cls = v.value > 0 ? "barRect" : "barRect is-zero";
      return `<rect class="${cls}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" rx="2" />`;
    }).join("");

    const maxLbl = util.eur(max);
    const firstLbl = (mode === "month") ? monthLabel(keys[0]) : ddmm(startMid);
    const lastLbl = (mode === "month") ? monthLabel(keys[keys.length-1]) : ddmm(endMid);

    el.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend Bestellwert (Balken)">
        ${rects}

        <!-- max label -->
        <text class="axisText" x="${padL}" y="10">${escapeHtml(maxLbl)}</text>

        <!-- x labels -->
        <text class="axisText" x="${padL}" y="${H-8}">${escapeHtml(firstLbl)}</text>
        <text class="axisText" x="${W-padR}" y="${H-8}" text-anchor="end">${escapeHtml(lastLbl)}</text>
      </svg>
    `;

    return { mode };
  }

  // -------- Tabs --------
  function setTab(t){
    const allowed = ["now", "period", "analysis"];
    const next = allowed.includes(String(t||"")) ? String(t) : "now";
    state.ui.dashboardTab = next;
    saveState();

    tabButtons.forEach(b=>{
      const isActive = b.getAttribute("data-dash-tab") === next;
      b.classList.toggle("is-active", isActive);
      b.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    panelNow.classList.toggle("is-hidden", next !== "now");
    panelPeriod.classList.toggle("is-hidden", next !== "period");
    if(panelAnalysis) panelAnalysis.classList.toggle("is-hidden", next !== "analysis");

    if(next === "now") renderNow();
    if(next === "period") renderPeriod();
    if(next === "analysis") renderAnalysis();
  }

  // -------- Render: NOW --------
  function renderNow(){
    updateNowFilterLabel();
    const scopedOrders = visibleOrdersForCurrentUser(state.orders || []).filter(orderMatchesOrg);
    const c = statusCounts(scopedOrders);

    const elIn = document.getElementById("dash-now-inApproval");
    const elQ = document.getElementById("dash-now-questions");
    const elReady = document.getElementById("dash-now-ready");

    if(elIn) elIn.textContent = String(c.inApproval);
    if(elQ) elQ.textContent = String(c.questions);
    if(elReady) elReady.textContent = String(c.ready);

    const cutoff = document.getElementById("dash-now-cutoff");
    if(cutoff) cutoff.textContent = String(mock.meta.cutoffLabel || "–");

    // Next batch: suppliers + value for ready orders
    const readyOrders = scopedOrders.filter(o => o.status === "Freigegeben");
    const vendors = new Set();
    let value = 0;
    for(const o of readyOrders){
      value += orderTotal(o);
      for(const it of (o.items || [])){
        if(it && it.vendor) vendors.add(it.vendor);
      }
    }

    const elSup = document.getElementById("dash-now-suppliers");
    const elVal = document.getElementById("dash-now-readyValue");
    if(elSup) elSup.textContent = vendors.size ? String(vendors.size) : "–";
    if(elVal) elVal.textContent = readyOrders.length ? util.eur(value) : "–";

    const chartEl = document.getElementById("dash-now-statusChart");
    renderBarChart(chartEl, [
      { label: "Freigegeben", count: c.ready, color: "var(--accent)" },
      { label: "In Freigabe", count: c.inApproval - c.questions, color: "var(--warn)" },
      { label: "Rückfrage", count: c.questions, color: "var(--violet)" },
      { label: "Im Bestelllauf", count: c.inBatch, color: "var(--accent)" },
      { label: "Bestellt", count: c.ordered, color: "var(--accent2)" },
      { label: "Teilw. abgeschlossen", count: c.partialDone, color: "rgba(var(--accent2-rgb),.6)" },
      { label: "Abgeschlossen", count: c.done, color: "var(--accent2)" }
    ]);
  }

  // -------- Render: PERIOD --------
  function normalizeRange(){
    const anchor = latestEventDate();

    let preset = state.ui.dashboardPreset || "30";
    let from = state.ui.dashboardFrom || "";
    let to = state.ui.dashboardTo || "";

    // Initialize defaults on first open
    if(!from || !to){
      preset = preset || "30";
      if(preset === "custom"){
        preset = "30";
      }
      const days = Number(preset) || 30;
      const end = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12,0,0,0);
      const start = new Date(end);
      start.setDate(start.getDate() - (days - 1));
      from = ymdLocal(start);
      to = ymdLocal(end);

      state.ui.dashboardPreset = String(days);
      state.ui.dashboardFrom = from;
      state.ui.dashboardTo = to;
      saveState();
    }

    // If preset (7/30/90), keep from/to synced to anchor
    if(preset !== "custom"){
      const days = Number(preset) || 30;
      const end = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12,0,0,0);
      const start = new Date(end);
      start.setDate(start.getDate() - (days - 1));
      from = ymdLocal(start);
      to = ymdLocal(end);
    }

    const startDate = parseYmdLocal(from) || new Date(anchor);
    const endDate = parseYmdLocal(to) || new Date(anchor);

    // Ensure ordering
    if(startDate.getTime() > endDate.getTime()){
      const tmp = new Date(startDate);
      startDate.setTime(endDate.getTime());
      endDate.setTime(tmp.getTime());
    }

    return { preset, from: ymdLocal(startDate), to: ymdLocal(endDate), startDate, endDate, anchor };
  }

  function updatePresetUi(preset){
    if(!presetWrap) return;
    presetWrap.querySelectorAll("[data-preset]").forEach(b=>{
      const isActive = b.getAttribute("data-preset") === preset;
      b.classList.toggle("is-active", isActive);
    });
  }

  function renderPeriod(){
    // Ensure filter UIs reflect current state
    updateOrgSelects();
    setSegmentedActive(mixDimWrap, "dim", String(state.ui.dashboardMixDim || "vendor"));
    setSegmentedActive(mixMetricWrap, "metric", String(state.ui.dashboardMixMetric || "value"));

    const r = normalizeRange();

    if(fromEl) fromEl.value = r.from;
    if(toEl) toEl.value = r.to;
    updatePresetUi(r.preset);

    const start = r.startDate;
    const end = r.endDate;

    if(rangeLabel){
      // v0.15.3: Always show filter status in the headline (helps screenshots and reduces ambiguity)
      rangeLabel.textContent = `Zeitraum: ${util.dt(start.toISOString())} – ${util.dt(end.toISOString())} · Filter: ${orgFilterLabel()}`;
    }

    // KPIs
    // In der Leitungssicht soll der Zeitraum konsistent sein: Anforderungen und POs beziehen sich
    // auf Bestellungen im Zeitraum (nicht zwingend auf "Erfasst am" der Anforderung).
    const placedParts = listPlacedParts().filter(p=> inRange(p.placedAt, start, end) && partMatchesOrg(p));

    const poSet = new Set(placedParts.map(p=>p.poNumber));
    const poCount = poSet.size;
    const poValue = placedParts.reduce((s,p)=> s + (Number(p.total)||0), 0);

    const reqInPos = new Set(placedParts.map(p=>p.orderId));
    const reqCount = reqInPos.size;
    const bundleAvg = (poCount && reqCount) ? (reqCount / poCount) : null;

    // Split-Quote: Anteil der Anforderungen, die in mehrere POs aufgeteilt werden (Multi-Lieferant)
    let splitShare = null;
    if(reqCount){
      const byOrder = {};
      for(const p of placedParts){
        const oid = String(p.orderId || "");
        if(!oid) continue;
        if(!byOrder[oid]) byOrder[oid] = new Set();
        byOrder[oid].add(String(p.poNumber || ""));
      }
      let splitOrders = 0;
      for(const oid of Object.keys(byOrder)){
        if(byOrder[oid].size > 1) splitOrders += 1;
      }
      splitShare = splitOrders / reqCount;
    }

    // Aggregation for Mix
    const vendorAgg = {};
    const contractAgg = {};
    for(const p of placedParts){
      const v = p.vendor || "–";
      if(!vendorAgg[v]) vendorAgg[v] = { value: 0, pos: new Set() };
      vendorAgg[v].value = Number((vendorAgg[v].value + (Number(p.total)||0)).toFixed(2));
      vendorAgg[v].pos.add(p.poNumber);

      const c = p.contract ? String(p.contract) : "Ohne Vertrag";
      if(!contractAgg[c]) contractAgg[c] = { value: 0, pos: new Set() };
      contractAgg[c].value = Number((contractAgg[c].value + (Number(p.total)||0)).toFixed(2));
      contractAgg[c].pos.add(p.poNumber);
    }

    const supplierCount = Object.keys(vendorAgg).length;

    // Write KPI values
    const setText = (id, txt)=>{ const el = document.getElementById(id); if(el) el.textContent = txt; };

    setText("dash-per-reqCount", String(reqCount));
    setText("dash-per-poCount", String(poCount));
    setText("dash-per-poValue", poCount ? util.eur(poValue) : "–");
    setText("dash-per-avgPo", poCount ? util.eur(poValue/poCount) : "–");
    setText("dash-per-bundle", (poCount && reqCount) ? dec(bundleAvg, 1) : "–");
    setText("dash-per-split", (reqCount && splitShare != null) ? `${Math.round(splitShare*100)}%` : "–");

    // Charts
    const pieEl = document.getElementById("dash-per-pie");
    const pieLegend = document.getElementById("dash-per-pieLegend");
    const pieHint = document.getElementById("dash-per-pieHint");

    const dim = String(state.ui.dashboardMixDim || "vendor");
    const metric = String(state.ui.dashboardMixMetric || "value");
    const dimLabel = (dim === "contract") ? "Rahmenvertrag" : "Lieferant";
    const metricLabel = (metric === "count") ? "Anzahl POs" : "Bestellwert";

    if(mixTitleEl){
      mixTitleEl.textContent = (dim === "contract") ? "Rahmenvertragsmix" : "Lieferantenmix";
    }

    if(pieEl){
      pieEl.setAttribute("aria-label", `${metricLabel} nach ${dimLabel}`);
    }

    renderDonut(pieEl, pieLegend, (dim === "contract") ? contractAgg : vendorAgg, { metric });

    if(pieHint){
      const f = selectedOrgFilter();
      const fTxt = (f.dept === "all" && f.unit === "all") ? "" : ` (Filter: ${orgFilterLabel()})`;
      pieHint.textContent = poCount
        ? `Basis: ${poCount} PO(s) im Zeitraum${fTxt} · Lieferanten: ${supplierCount}.`
        : "Tipp: Erst Bestelllauf → Bestellung auslösen, dann werden POs sichtbar.";
    }

    const lineEl = document.getElementById("dash-per-line");
    const lineHint = document.getElementById("dash-per-lineHint");
    const trend = renderTrendBars(lineEl, start, end, placedParts);
    if(lineHint){
      if(!poCount){
        lineHint.textContent = "Noch keine Bestellungen im Zeitraum.";
      }else{
        const label = (trend.mode === "week") ? "Wochenwerte" : (trend.mode === "month") ? "Monatswerte" : "Tageswerte";
        lineHint.textContent = `${label} als Balken (ohne externe Libraries). 0-Werte werden als 0 dargestellt.`;
      }
    }
  }

  // -------- Render: ANALYSE --------
  function renderAnalysis(){
    if(!panelAnalysis) return;
    // Analyse uses the same Zeitraum/Filter as "Lagebild".
    updateOrgSelects();
    setSegmentedActive(anaMetricWrap, "metric", String(state.ui.dashboardAnaMetric || "value"));

    const r = normalizeRange();
    const start = r.startDate;
    const end = r.endDate;

    const parts = listPlacedParts().filter(p=> inRange(p.placedAt, start, end) && partMatchesOrg(p));
    const poSet = new Set(parts.map(p=> p.poNumber));
    const poCount = poSet.size;
    const poValue = parts.reduce((s,p)=> s + (Number(p.total)||0), 0);

    const f = selectedOrgFilter();
    const fTxt = (f.dept === "all" && f.unit === "all") ? "Alle" : orgFilterLabel();
    if(anaContext){
      anaContext.textContent = `Zeitraum: ${util.dt(start.toISOString())} – ${util.dt(end.toISOString())} · Filter: ${fTxt} · Basis: ${poCount} PO(s) · ${util.eur(poValue)}`;
    }

    if(!poCount){
      if(anaTopOrgs) anaTopOrgs.innerHTML = `<div class="muted">Noch keine Bestellungen im Zeitraum.</div>`;
      if(anaTopCosts) anaTopCosts.innerHTML = `<div class="muted">Noch keine Bestellungen im Zeitraum.</div>`;
      if(anaTopOrgsHint) anaTopOrgsHint.textContent = "Tipp: Erst Bestelllauf → Bestellung auslösen, dann werden POs sichtbar.";
      if(anaTopCostsHint) anaTopCostsHint.textContent = "Tipp: Erst Bestelllauf → Bestellung auslösen, dann werden POs sichtbar.";
      return;
    }

    const metric = String(state.ui.dashboardAnaMetric || "value");
    const colors = ["var(--accent)", "var(--accent2)", "var(--violet)", "var(--warn)", "rgba(var(--accent-rgb),.45)", "rgba(var(--accent2-rgb),.45)"];

    // --- Top Ämter ---
    const orgAgg = new Map();
    for(const p of parts){
      const key = String(p.orgId || "").trim() || "unknown";
      const u = ORG_BY_ID[p.orgId] || null;
      const label = u ? formatOrgUnit(u) : (p.orgId ? String(p.orgId) : "(unbekannt)");
      let obj = orgAgg.get(key);
      if(!obj){ obj = { key, label, value: 0, pos: new Set() }; orgAgg.set(key, obj); }
      obj.value = Number((obj.value + (Number(p.total)||0)).toFixed(2));
      obj.pos.add(p.poNumber);
    }
    let orgRows = Array.from(orgAgg.values()).map(o=> ({
      key: o.key,
      label: o.label,
      value: o.value,
      count: o.pos.size
    }));
    orgRows.sort((a,b)=> (metric === "count" ? (b.count - a.count) : (b.value - a.value)));
    orgRows = topNWithOther(orgRows, 5).map((r, idx)=> ({
      ...r,
      kind: "org",
      members: Array.isArray(r.members) ? r.members : [String(r.key)],
      color: colors[idx % colors.length]
    }));

    renderMetricBarChart(anaTopOrgs, orgRows, {
      clickable: true,
      valueKey: (metric === "count") ? "count" : "value",
      formatValue: (v)=> metric === "count" ? `${Math.round(v)}` : util.eur(v)
    });

    if(anaTopOrgsHint){
      const label = (metric === "count") ? "Anzahl POs" : "Bestellwert";
      anaTopOrgsHint.textContent = `Top ${Math.min(5, orgAgg.size)} nach ${label} (PO-Teile im Zeitraum).`;
    }

    // --- Top Kostenstellen ---
    const ccAgg = new Map();
    for(const p of parts){
      const code = String(p.costCenter || "").trim();
      const key = code || "none";
      const label = code ? costCenterLabel(code) : "Ohne Kostenstelle";
      let obj = ccAgg.get(key);
      if(!obj){ obj = { key, label, value: 0, pos: new Set() }; ccAgg.set(key, obj); }
      obj.value = Number((obj.value + (Number(p.total)||0)).toFixed(2));
      obj.pos.add(p.poNumber);
    }
    let ccRows = Array.from(ccAgg.values()).map(o=> ({
      key: o.key,
      label: o.label,
      value: o.value,
      count: o.pos.size
    }));
    ccRows.sort((a,b)=> (metric === "count" ? (b.count - a.count) : (b.value - a.value)));
    ccRows = topNWithOther(ccRows, 5).map((r, idx)=> ({
      ...r,
      kind: "cc",
      members: Array.isArray(r.members) ? r.members : [String(r.key)],
      color: colors[idx % colors.length]
    }));

    renderMetricBarChart(anaTopCosts, ccRows, {
      clickable: true,
      valueKey: (metric === "count") ? "count" : "value",
      formatValue: (v)=> metric === "count" ? `${Math.round(v)}` : util.eur(v)
    });

    if(anaTopCostsHint){
      const label = (metric === "count") ? "Anzahl POs" : "Bestellwert";
      anaTopCostsHint.textContent = `Top ${Math.min(5, ccAgg.size)} nach ${label} (Kostenstellen aus den Anforderungen).`;
    }

    // Cache for drilldown
    analysisCache = {
      start, end, metric,
      filterLabel: fTxt,
      totalPoCount: poCount,
      totalPoValue: poValue,
      parts,
      orgRows,
      ccRows
    };
  }

  // -------- Analyse Drilldown (v0.15) --------
  function openAnalysisDrill(kind, key){
    if(!analysisCache || !Array.isArray(analysisCache.parts)){
      openModal(`<div class="muted">Keine Analysedaten verfügbar. Bitte einmal zum Tab „Analyse“ wechseln.</div>`);
      return;
    }

    const k = String(key || "");
    const rows = (kind === "cc") ? (analysisCache.ccRows || []) : (analysisCache.orgRows || []);
    const row = rows.find(r => String(r.key) === k) || null;
    if(!row){
      openModal(`<div class="muted">Eintrag nicht gefunden.</div>`);
      return;
    }

    const members = Array.isArray(row.members) && row.members.length ? row.members.map(String) : [k];
    const parts = (analysisCache.parts || []).filter(p => {
      if(kind === "cc"){
        const cc = String(p.costCenter || "").trim() || "none";
        return members.includes(cc);
      }
      const orgId = String(p.orgId || "").trim() || "unknown";
      return members.includes(orgId);
    });

    // Sort by value desc, then date desc
    parts.sort((a,b)=>{
      const dv = (Number(b.total||0) - Number(a.total||0));
      if(dv !== 0) return dv;
      return (new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
    });

    const top = parts.slice(0, 10);
    const poSet = new Set(parts.map(p=> p.poNumber));
    const poCount = poSet.size;
    const poValue = parts.reduce((s,p)=> s + (Number(p.total)||0), 0);
    const share = analysisCache.totalPoValue > 0 ? (poValue / analysisCache.totalPoValue) * 100 : 0;

    const titlePrefix = (kind === "cc") ? "Kostenstelle" : "Amt";
    const title = `${titlePrefix}: ${row.label}`;
    const scope = `Zeitraum: ${util.dt(analysisCache.start.toISOString())} – ${util.dt(analysisCache.end.toISOString())} · Filter: ${analysisCache.filterLabel}`;

    const tableRows = top.map(p=>{
      const contract = p.contract ? String(p.contract) : "–";
      return `
        <tr data-order-id="${escapeHtml(p.orderId)}">
          <td>${escapeHtml(util.dt(p.placedAt.toISOString()))}</td>
          <td><strong>${escapeHtml(p.poNumber || "–")}</strong></td>
          <td><strong>${escapeHtml(p.vendor || "–")}</strong><div class="muted small">${escapeHtml(contract)}</div></td>
          <td><strong>${escapeHtml(p.orderId)}</strong></td>
          <td class="right"><strong>${escapeHtml(util.eur(Number(p.total||0)))}</strong></td>
        </tr>
      `;
    }).join("");

    const hint = top.length
      ? `<div class="muted small" style="margin-top:10px;">Tipp: Klick auf eine Zeile öffnet die Detailansicht der Anforderung.</div>`
      : "";

    openModal(`
      <div class="muted small">${escapeHtml(scope)}</div>
      <div class="divider" style="margin:10px 0;"></div>
      <div class="kpiRow" style="grid-template-columns:repeat(3, minmax(0,1fr));">
        <div class="kpiRow__item"><div class="kpiRow__label">Bestellwert</div><div class="kpiRow__value">${escapeHtml(util.eur(poValue))}</div></div>
        <div class="kpiRow__item"><div class="kpiRow__label">POs</div><div class="kpiRow__value">${escapeHtml(String(poCount))}</div></div>
        <div class="kpiRow__item"><div class="kpiRow__label">Anteil am Gesamtwert (im Zeitraum)</div><div class="kpiRow__value">${escapeHtml(share.toFixed(0))}%</div></div>
      </div>

      <h2 class="h2" style="margin-top:14px;">Top POs</h2>
      <div class="tableWrap" style="margin-top:10px;">
        <table class="table table--drilldown">
          <thead>
            <tr>
              <th>Datum</th>
              <th>PO</th>
              <th>Lieferant</th>
              <th>Anforderung</th>
              <th class="right">Wert</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || `<tr><td colspan="5">–</td></tr>`}
          </tbody>
        </table>
      </div>
      ${hint}
    `, { title, context: { type: "analysis" } });

    // Bind row clicks → open order details
    const tbody = document.querySelector("#modal-body table.table tbody");
    if(tbody){
      tbody.querySelectorAll("tr[data-order-id]").forEach(tr=>{
        tr.addEventListener("click", ()=>{
          const oid = tr.getAttribute("data-order-id");
          const order = findOrderById(oid);
          if(order){
            // switch to order detail modal
            openOrderDetails(order);
          }
        });
      });
    }
  }

  // Bind events
  tabButtons.forEach(b=>{
    b.addEventListener("click", ()=> setTab(b.getAttribute("data-dash-tab")));
  });

  if(presetWrap){
    presetWrap.querySelectorAll("[data-preset]").forEach(b=>{
      b.addEventListener("click", ()=>{
        const p = b.getAttribute("data-preset");
        if(p === "custom"){
          // Keep current from/to as last computed/shown range
          state.ui.dashboardPreset = "custom";
        }else{
          // v0.15.3: Presets also update from/to so switching to "Custom" is not surprising.
          const days = Number(p) || 30;
          const anchor = latestEventDate();
          const end = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12,0,0,0);
          const start = new Date(end);
          start.setDate(start.getDate() - (days - 1));

          state.ui.dashboardPreset = String(days);
          state.ui.dashboardFrom = ymdLocal(start);
          state.ui.dashboardTo = ymdLocal(end);
        }
        saveState();
        renderPeriod();
        renderAnalysis();
      });
    });
  }

  if(btnApply){
    btnApply.addEventListener("click", ()=>{
      state.ui.dashboardPreset = "custom";
      state.ui.dashboardFrom = fromEl ? (fromEl.value || "") : "";
      state.ui.dashboardTo = toEl ? (toEl.value || "") : "";
      saveState();
      renderPeriod();
      renderAnalysis();
    });
  }

  // v0.15.3: Pressing Enter in date inputs triggers "Anwenden".
  function bindApplyOnEnter(input){
    if(!input || !btnApply) return;
    input.addEventListener("keydown", (e)=>{
      if(e.key === "Enter"){
        e.preventDefault();
        try{ btnApply.click(); }catch(_){/* ignore */}
      }
    });
  }
  bindApplyOnEnter(fromEl);
  bindApplyOnEnter(toEl);

  if(deptEl){
    deptEl.addEventListener("change", ()=>{
      state.ui.dashboardDept = deptEl.value || "all";
      state.ui.dashboardUnit = "all"; // Fachbereich-Wechsel setzt Amt zurück
      saveState();
      updateOrgSelects();
      renderNow();
      renderPeriod();
      renderAnalysis();
    });
  }

  if(unitEl){
    unitEl.addEventListener("change", ()=>{
      const nextUnit = unitEl.value || "all";
      state.ui.dashboardUnit = nextUnit;
      if(nextUnit !== "all" && ORG_BY_ID[nextUnit]){
        state.ui.dashboardDept = String(ORG_BY_ID[nextUnit].deptId || "all");
      }
      saveState();
      updateOrgSelects();
      renderNow();
      renderPeriod();
      renderAnalysis();
    });
  }

  if(mixDimWrap){
    mixDimWrap.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-dim]");
      if(!btn) return;
      state.ui.dashboardMixDim = String(btn.getAttribute("data-dim") || "vendor");
      saveState();
      renderPeriod();
    });
  }

  if(mixMetricWrap){
    mixMetricWrap.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-metric]");
      if(!btn) return;
      state.ui.dashboardMixMetric = String(btn.getAttribute("data-metric") || "value");
      saveState();
      renderPeriod();
    });
  }

  // Analyse controls
  if(anaMetricWrap){
    anaMetricWrap.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-metric]");
      if(!btn) return;
      state.ui.dashboardAnaMetric = String(btn.getAttribute("data-metric") || "value");
      saveState();
      renderAnalysis();
    });
  }

  // Analyse drilldown: click on a bar row
  if(anaTopOrgs){
    anaTopOrgs.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-kind][data-key]");
      if(!btn) return;
      openAnalysisDrill(String(btn.getAttribute("data-kind")), String(btn.getAttribute("data-key")));
    });
  }

  if(anaTopCosts){
    anaTopCosts.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-kind][data-key]");
      if(!btn) return;
      openAnalysisDrill(String(btn.getAttribute("data-kind")), String(btn.getAttribute("data-key")));
    });
  }

  if(anaJumpFilters){
    anaJumpFilters.addEventListener("click", ()=>{
      setTab("period");
      // v0.15.3: Smooth jump + visible focus cue for the filter bar
      setTimeout(()=>{
        try{
          const card = document.getElementById("dash-period-filters");
          if(card && typeof card.scrollIntoView === "function"){
            card.scrollIntoView({ behavior: "smooth", block: "start" });
            card.classList.add("is-flash");
            setTimeout(()=>{ try{ card.classList.remove("is-flash"); }catch(_){/* ignore */} }, 1200);
          }
        }catch(_){/* ignore */}
        try{ if(deptEl) deptEl.focus(); }catch(_){/* ignore */}
      }, 80);
    });
  }

  // init
  updateOrgSelects();
  updateNowFilterLabel();
  setTab(state.ui.dashboardTab || "now");
}

// ---------- Modal ----------
  let modalContext = null;

  function setModalContext(ctx){
    modalContext = ctx || null;
    const printable = !!(modalContext && modalContext.type === "order");
    if(els.modal) els.modal.classList.toggle("is-printable", printable);
    // PDF-Button nur bei Order-Details zeigen
    if(els.modalPrint){
      els.modalPrint.style.display = printable ? "" : "none";
    }
  }

  function openModal(html, opts){
    const o = opts || {};
    const title = o.title || "Details";
    if(els.modalTitle) els.modalTitle.textContent = title;

    els.modalBody.innerHTML = html;
    setModalContext(o.context || null);

    els.modal.classList.add("is-open");
    els.modal.setAttribute("aria-hidden","false");
  }

  function closeModal(){
    els.modal.classList.remove("is-open");
    els.modal.setAttribute("aria-hidden","true");
    els.modalBody.innerHTML = "";
    setModalContext(null);
    clearPrintRoot();
  }

  function clearPrintRoot(){
    if(!els.printRoot) return;
    els.printRoot.innerHTML = "";
    els.printRoot.setAttribute("aria-hidden","true");
  }

  function findOrderById(id){
    return state.orders.find(o => o.id === id) || state.historyOrders.find(o => o.id === id) || null;
  }

  function buildPrintOrderHtml(order){
    const total = orderTotal(order);
    const nItems = (order.items||[]).reduce((s,it)=> s + Number(it.qty||0), 0);

    const vendors = orderVendors(order);
    const contracts = orderContracts(order);
    const parts = splitParts(order);

    const poNumbers = parts.length ? parts.map(p=>p.poNumber).filter(Boolean) : (order.poNumbers || []);
    const created = order.createdAt ? util.dt(order.createdAt) : "–";
    const exported = util.dt(new Date().toISOString());

    const grid = `
      <div class="printGrid">
        <div class="k">ID</div><div><strong>${escapeHtml(order.id)}</strong></div>
        <div class="k">Status</div><div>${escapeHtml(order.status||"–")}</div>
        <div class="k">Gate-Grund</div><div>${escapeHtml(orderGateReason(order))}</div>
        <div class="k">Organisation</div><div>${escapeHtml(orderOrgLabel(order))}</div>
        <div class="k">Fachbereich</div><div>${escapeHtml(orderDeptLabel(order))}</div>
        <div class="k">Kostenstelle</div><div>${escapeHtml(orderCostCenterLabel(order))}</div>
        <div class="k">Verwendungszweck</div><div>${escapeHtml(order.purpose||"–")}</div>
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

  function printCurrentModal(){
    if(!modalContext || modalContext.type !== "order") return;
    const order = findOrderById(modalContext.orderId);
    if(!order) return;

    if(els.printRoot){
      els.printRoot.innerHTML = buildPrintOrderHtml(order);
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

// ---------- View: New Order ----------
  function mountNewOrder(){
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
      const user = getCurrentUser();
      const userUnitId = user && user.unitId ? String(user.unitId) : "";
      const isCentral = user && hasRoleKey(user, "central");

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

      const items = entries.map(e=>({
        id: e.item.id,
        title: e.item.title,
        unit: e.item.unit,
        qty: e.qty,
        price: e.item.price,
        vendor: e.item.vendor,
        contract: e.item.contract
      }));

      const vendors = Array.from(new Set(items.map(it => it.vendor).filter(Boolean)));

      const total = items.reduce((sum,it)=> sum + it.qty * Number(it.price), 0);
      const threshold = Number(mock.meta.gateThreshold || 25);

      const hasSpecial = entries.some(e => e.item && e.item.special);

      // Special items => justification mandatory (demo rule)
      if(hasSpecial && exception.length === 0){
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

      const reasons = [];
      if(hasSpecial) reasons.push("Sonderbedarf");
      if(exception.length) reasons.push("Sonderbedarf (Begründung)");
      if(total >= threshold) reasons.push(`Summe ≥ ${threshold} €`);
      if(urgency === "urgent") reasons.push("Dringlichkeit: dringend");

      const needsGate = reasons.length > 0;
      const status = needsGate ? "In Freigabe" : "Freigegeben";
      const gateReason = needsGate ? reasons.join(" · ") : "";

      const id = nextOrderId();
      const now = nowIso();

      const p = permissions();
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
      pushActivity({ text: `Anforderung ${id} erfasst (Status: ${status})`, orderId: id, audience: ["user"] });
      if(needsGate){
        pushActivity({ text: `Neue Freigabe: ${id} (${gateReason})`, orderId: id, audience: ["approver"] });
      }else{
        pushActivity({ text: `Freigegeben: ${id} bereit für Bestelllauf`, orderId: id, audience: ["central"] });
      }
      pushActivity({ text: `Transparenz: ${id} im Audit-Trail nachvollziehbar`, orderId: id, audience: ["lead"] });

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

  // ---------- View: Orders ----------
  function mountOrders(){
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
      // Sichtbarkeit richtet sich nach Persona/Scope:
      // - Mitarbeitende: nur eigene Anforderungen
      // - Amtsleitung: Anforderungen des eigenen Amts
      // - Fachbereichsleitung/Freigabe: Anforderungen des eigenen Fachbereichs
      // - Zentrale Beschaffung / org-weite Leitung / Bürgermeisterin: alles
      const base = visibleOrdersForCurrentUser(state.orders || []);
      const rows = base.filter(o => matchFilter(o) && matchSearch(o));
      tbody.innerHTML = rows.map(o=>{
        const total = orderTotal(o);
        const nItems = (o.items||[]).reduce((s,it)=> s + Number(it.qty||0), 0);
        return `
          <tr data-id="${escapeHtml(o.id)}" class="rowlink" tabindex="0" role="button">
            <td><strong>${escapeHtml(o.id)}</strong></td>
            <td>${escapeHtml(util.dt(o.createdAt))}</td>
            <td>${statusChip(o.status)}</td>
            <td>${escapeHtml(ownerNameById(o.ownerId))}</td>
            <td><strong>${escapeHtml(vendorsLabel(o))}</strong><div class="muted small">${escapeHtml(orderVendors(o).length === 1 ? (orderContract(o) || "") : vendorsFullLabel(o))}</div></td>
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
          if(order) openOrderDetails(order);
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
        if(order) openOrderDetails(order);
      }
    }

    renderTable();
  }

	  // Reusable HTML fragment for both
	  // - Modal "Meine Anforderungen" (openOrderDetails)
	  // - Split-View "Freigaben" (Arbeitsfläche)
	  function orderDetailsHtml(order){
	    if(!order) return `<div class="cart__empty">Keine Auswahl.</div>`;

	    const total = orderTotal(order);
	    const nItems = (order.items||[]).reduce((s,it)=> s + Number(it.qty||0), 0);

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

	    const questionBlock = renderQuestionBlock(order);

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

	    return `
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
	    `;
	  }

  function openOrderDetails(order){
    const total = orderTotal(order);
    const nItems = (order.items||[]).reduce((s,it)=> s + Number(it.qty||0), 0);

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

    const questionBlock = renderQuestionBlock(order);

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
        const p = permissions();
        const by = p.user ? p.user.name : "Mitarbeitende";
        order.answer = { at: nowIso(), by, text: txt };
        order.status = "In Freigabe";
        order.audit = order.audit || [];
        order.audit.push({ at: nowIso(), who: by, what: "Rückfrage beantwortet" });
        saveState();

        pushActivity({ text: `Antwort auf Rückfrage zu ${order.id} eingegangen`, orderId: order.id, audience: ["approver"] });
        pushActivity({ text: `${order.id} wieder in Freigabe`, orderId: order.id, audience: ["user"] });

        closeModal();
        navTo("/app/orders");
      });
    }
  }

  function renderQuestionBlock(order){
    const q = order.question && order.question.text ? order.question : null;
    if(!q) return "";

    const answered = order.answer && order.answer.text;

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

    // Offer answer form only for Mitarbeitende / lead (demo)
    // Nur Anforderer*in kann Rückfragen beantworten (Demo-Logik)
    const cur = getCurrentUserId();
    if(order.ownerId && order.ownerId !== cur) return qHtml;

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
  function orderDetailsHtml(order){
    if(!order) return "";

    const owner = orderOwnerLabel(order);
    const total = orderTotal(order);
    const vendorsTxt = vendorsFullLabel(order);
    const contractsTxt = contractsFullLabel(order);
    const gate = orderGateReason(order);

    const poBlock = (order.poNumbers && order.poNumbers.length)
      ? `<div class="callout" style="margin-top:10px;"><div class="callout__title">Bestellungen</div><div class="callout__text">${order.poNumbers.map(p=> `<span class="pill">${escapeHtml(p)}</span>`).join(" ")}</div></div>`
      : "";

    const questionBlock = renderQuestionBlock(order);

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

  // ---------- View: Approvals ----------
  function mountApprovals(){
    const listEl = document.getElementById("approvals-list");
    const detailEl = document.getElementById("approvals-detail");
    if(!listEl) return;

    const caps = permissions();
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

        ${orderDetailsHtml(order)}
      `;

      const btnApprove = detailEl.querySelector('[data-ap-action="approve"]');
      const btnQuestion = detailEl.querySelector('[data-ap-action="question"]');
      const btnReject = detailEl.querySelector('[data-ap-action="reject"]');

      if(btnApprove) btnApprove.addEventListener('click', ()=>{ approve(order); render(); });
      if(btnQuestion) btnQuestion.addEventListener('click', ()=> question(order));
      if(btnReject) btnReject.addEventListener('click', ()=>{ reject(order); render(); });
    }

    function render(){
      const list = approvals();
      if(!list.length){
        listEl.innerHTML = `<div class="callout"><div class="callout__title">Alles erledigt</div><div class="callout__text">Derzeit gibt es keine Anforderungen <strong>in Freigabe</strong> im eigenen Bereich.</div></div>`;
        if(detailEl) detailEl.innerHTML = `<div class="cart__empty">Keine Anforderungen zur Prüfung.</div>`;
        return;
      }

      const selId = ensureSelection(list);

      listEl.innerHTML = list.map(o=>{
        const total = orderTotal(o);
        const nItems = (o.items||[]).reduce((s,it)=> s + Number(it.qty||0), 0);
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
          const o = list.find(x => String(x.id) === String(id)) || null;
          // nur Detail neu rendern, Liste markiert sich über komplettes render()
          render();
        });
      });

      const selected = list.find(o => String(o.id) === String(selId)) || null;
      renderDetail(selected);
    }

    render();
  }

  // ---------- View: Batch ----------
  function mountBatch(){
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
      return g;
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

            const actions =
              (g.status === "Im Bestelllauf") ? `<button class="btn btn--primary" data-place="${escapeHtml(vendor)}">Bestellung auslösen</button>`
              : (g.status === "Bestellt") ? `<button class="btn btn--primary" data-complete="${escapeHtml(vendor)}">Als abgeschlossen markieren</button>`
              : `<span class="muted small">Abgeschlossen</span>`;

            return `
              <div class="item" style="margin-bottom:10px;">
                <div style="min-width:0;">
                  <div class="item__title">${escapeHtml(vendor)} ${status}</div>
                  <div class="item__meta">${contract}${g.orderCount} Anforderungen · ${g.lineCount} Positionen · ${escapeHtml(util.eur(g.total))}${po}</div>
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

      if(!g.poNumber){
        g.poNumber = nextPo();
      }
      g.status = "Bestellt";

      const now = nowIso();

      // Update related orders (only this vendor part)
      for(const id of (g.orderIds || [])){
        const o = state.orders.find(x=>x.id===id);
        if(!o) continue;

        const parts = splitParts(o);
        const p = parts.find(x=>x.vendor === vendor);
        if(p){
          p.status = "Bestellt";
          p.poNumber = g.poNumber;
        }

        if(!o.poNumbers) o.poNumbers = [];
        if(!o.poNumbers.includes(g.poNumber)) o.poNumbers.push(g.poNumber);

        o.audit = o.audit || [];
        o.audit.push({ at: now, who: "Zentrale Beschaffung", what: `Bestellt: ${vendor} (${g.poNumber})` });

        syncAggregate(o);

        pushActivity({ text: `${o.id}: Teilbestellung ${vendor} bestellt (${g.poNumber})`, orderId: o.id, audience: ["user"] });
      }

      batch.groups[vendor] = g;
      state.ui.lastBatch = batch;
      saveState();

      renderOut(batch);
      pushActivity({ text: `Bestellung ausgelöst: ${vendor} (${g.poNumber})`, audience: ["central","lead"] });
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