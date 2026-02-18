/* social_order_v0.19.3 · core/store (ESM)
   Persistenter Demo-State (localStorage), tolerant gegenüber älteren Keys.
   Enthält nur Speicher-/Seed-Logik, kein UI- oder Domänenwissen.
*/

export function createStore({ version, state, mock, deepClone, ensureSession, people }){
  const VERSION = String(version || "").trim();

  // Historisch wurden Keys als "social_order_state_v0_15_7" etc gespeichert.
  const STORAGE_KEY = `social_order_state_v${VERSION.replaceAll(".","_")}`;

  // Tolerant gegenüber Zwischenständen (ohne v-Prefix) und älteren Versionen.
  const STORAGE_KEYS_FALLBACK = [
    // (tolerant) Letzte Versionen
    "social_order_state_0_19_2_1",
    "social_order_state_v0_19_2_1",

    "social_order_state_0_19_2",
    "social_order_state_v0_19_2",

    "social_order_state_0_19_1",
    "social_order_state_v0_19_1",

    "social_order_state_0_19_0",
    "social_order_state_v0_19_0",

    "social_order_state_0_18_9_2",
    "social_order_state_v0_18_9_2",

    "social_order_state_0_18_9_1",
    "social_order_state_v0_18_9_1",

    "social_order_state_0_18_9",
    "social_order_state_v0_18_9",

    "social_order_state_0_18_8",
    "social_order_state_v0_18_8",

    "social_order_state_0_18_7",
    "social_order_state_v0_18_7",

    "social_order_state_0_18_6_2",
    "social_order_state_v0_18_6_2",

    "social_order_state_0_18_6_1",
    "social_order_state_v0_18_6_1",

    "social_order_state_0_18_6",
    "social_order_state_v0_18_6",

    "social_order_state_0_18_5",
    "social_order_state_v0_18_5",

    "social_order_state_0_18_4",
    "social_order_state_v0_18_4",

    "social_order_state_0_18_3",
    "social_order_state_v0_18_3",

    "social_order_state_0_18_2",
    "social_order_state_v0_18_2",

    "social_order_state_0_18_1",
    "social_order_state_v0_18_1",

    "social_order_state_0_18_0",
    "social_order_state_v0_18_0",

    "social_order_state_0_17_9",
    "social_order_state_v0_17_9",
    "social_order_state_0_17_8",
    "social_order_state_v0_17_8",
    "social_order_state_0_17_7",
    "social_order_state_v0_17_7",
    "social_order_state_0_17_6",
    "social_order_state_v0_17_6",
    "social_order_state_0_17_5",
    "social_order_state_v0_17_5",

    // (tolerant) Vorletzte Versionen
    "social_order_state_0_17_4",
    "social_order_state_v0_17_4",
    "social_order_state_0_17_3",
    "social_order_state_v0_17_3",
    "social_order_state_0_17_2",
    "social_order_state_v0_17_2",
    "social_order_state_0_17_1",
    "social_order_state_v0_17_1",

    // (tolerant) Letzte Hauptversion
    "social_order_state_0_16_7",
    "social_order_state_v0_16_7",

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

  function nowIso(){ return new Date().toISOString(); }

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
      if(typeof ensureSession === 'function') ensureSession();

      // Catalog: if old schema (no group field), use current mock catalog
      const catOk = Array.isArray(s.catalog) && s.catalog.length > 0 && s.catalog.every(it => it && typeof it === "object" && ("group" in it));
      state.catalog = catOk ? s.catalog : (typeof deepClone === 'function' ? deepClone(mock.catalog) : JSON.parse(JSON.stringify(mock.catalog)));

      // Activities (optional in older versions)
      state.activities = Array.isArray(s.activities) ? s.activities : [];

      // UI: merge (keeps defaults for new fields)
      state.ui = Object.assign({}, state.ui, (s.ui || {}));

      // Ensure org context exists (GovConnect shell framing)
      if(!state.ui.orgContext) state.ui.orgContext = "city";

      // Ensure activitySeenAt exists (migration safety)
      // activitySeenAt: ab v0.16.0 pro User-ID (nicht mehr pro Rolle)
      const seen = (s.ui && s.ui.activitySeenAtByUser && typeof s.ui.activitySeenAtByUser === 'object')
        ? s.ui.activitySeenAtByUser
        : ((s.ui && s.ui.activitySeenAt && typeof s.ui.activitySeenAt === 'object') ? s.ui.activitySeenAt : null);
      if(seen && (("user" in seen) || ("approver" in seen) || ("central" in seen) || ("lead" in seen))){
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
    }catch(_){/* ignore */}
  }

  function resetDemo(){
    try{
      localStorage.removeItem(STORAGE_KEY);
      for(const k of (STORAGE_KEYS_FALLBACK || [])){
        try{ localStorage.removeItem(k); }catch(_){ }
      }
    }catch(_){ }
    // Theme bleibt bewusst erhalten (Theme-Key liegt außerhalb dieses Moduls)
    location.reload();
  }

  function seedActivitiesFromOrders(){
    if(state.activities && state.activities.length) return;

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

    acts.sort((a,b)=> new Date(b.at) - new Date(a.at));
    state.activities = acts.slice(0, 20);

    // Mark everything as seen for all Testpersonen at first load (prevents huge red badge)
    const latest = state.activities.length ? state.activities[0].at : nowIso();
    state.ui.activitySeenAtByUser = {};
    const arr = Array.isArray(people) ? people : [];
    for(const p of arr){
      if(p && p.id) state.ui.activitySeenAtByUser[p.id] = latest;
    }
  }

  function initData(){
    if(typeof ensureSession === 'function') ensureSession();
    const ok = loadState();
    if(!ok){
      state.catalog = (typeof deepClone === 'function') ? deepClone(mock.catalog) : JSON.parse(JSON.stringify(mock.catalog));
      state.orders = (typeof deepClone === 'function') ? deepClone(mock.orders) : JSON.parse(JSON.stringify(mock.orders));
      state.historyOrders = (typeof deepClone === 'function') ? deepClone(mock.historyOrders || []) : JSON.parse(JSON.stringify(mock.historyOrders || []));
      state.activities = [];
      seedActivitiesFromOrders();
      saveState();
    }else{
      // If upgrading from older versions (no feed), seed once
      seedActivitiesFromOrders();

      // Ensure dashboard history exists
      if(!Array.isArray(state.historyOrders) || state.historyOrders.length === 0){
        state.historyOrders = (typeof deepClone === 'function') ? deepClone(mock.historyOrders || []) : JSON.parse(JSON.stringify(mock.historyOrders || []));
      }

      saveState();
    }
  }

  return {
    STORAGE_KEY,
    STORAGE_KEYS_FALLBACK,
    loadState,
    saveState,
    resetDemo,
    seedActivitiesFromOrders,
    initData
  };
}
