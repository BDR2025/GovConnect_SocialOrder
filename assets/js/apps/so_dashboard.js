/* social_order_v0.18.6 · apps/so_dashboard (ESM)
   Dashboard-Ansicht (Steuerung/Lagebild/Analyse) – ausgelagert aus app.js.
   Keine Funktionsänderung gegenüber v0.18.0, nur Modul-Schnitt.
*/

export function mountDashboard(ctx){
  const {
    state,
    mock,
    permissions,
    saveState,
    visibleOrdersForCurrentUser,
    orderTotal,
    orderVendors,
    orderVendor,
    orderOrgLabel,
    orderOrgUnit,
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
  } = ctx;

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
          trigger: part.trigger || "",
          shippingFee: Number(part.shippingFee || 0),
          shippingAllocations: Array.isArray(part.shippingAllocations) ? part.shippingAllocations : [],
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

    // Dringlichkeit: Anteil dringender Anforderungen (bezogen auf Anforderungen mit Bestellung im Zeitraum)
    let urgentShare = null;
    if(reqCount){
      const all = analyticsOrders();
      const byId = new Map(all.map(o=>[String(o.id), o]));
      let urg = 0;
      for(const oid of reqInPos){
        const o = byId.get(String(oid));
        if(o && String(o.urgency||"") === "urgent") urg += 1;
      }
      urgentShare = urg / reqCount;
    }

    // Versand- & Governance-KPIs (PO-basiert, um Doppelzählung pro Teilbestellung zu vermeiden)
    const poInfo = new Map();
    for(const p of placedParts){
      const k = String(p.poNumber || "");
      if(!k) continue;
      if(!poInfo.has(k)){
        poInfo.set(k, {
          poNumber: k,
          trigger: String(p.trigger || ""),
          shippingFee: Number(p.shippingFee || 0),
          shippingAllocations: Array.isArray(p.shippingAllocations) ? p.shippingAllocations : []
        });
      }
    }

    let shipTotal = 0;
    let shipZb = 0;
    let underMbwCount = 0;
    let overrideCount = 0;
    for(const info of poInfo.values()){
      const trig = String(info.trigger || "");
      const ship = Number(info.shippingFee || 0);
      const under = (trig && trig !== "standard") || ship > 0;
      if(under) underMbwCount += 1;
      if(ship > 0) shipTotal += ship;
      if(trig === "zb_override"){
        overrideCount += 1;
        if(ship > 0) shipZb += ship;
      }
    }
    shipTotal = Number(shipTotal.toFixed(2));
    shipZb = Number(shipZb.toFixed(2));
    const shipQuote = poValue > 0 ? (shipTotal / poValue) : null;

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

    setText("dash-per-urgentShare", (reqCount && urgentShare != null) ? `${Math.round(urgentShare*100)}%` : "–");
    setText("dash-per-shipTotal", poCount ? util.eur(shipTotal) : "–");
    setText("dash-per-shipQuote", (poCount && shipQuote != null) ? `${dec(shipQuote*100, 1)}%` : "–");
    setText("dash-per-underMbw", poCount ? `${underMbwCount} (${Math.round((underMbwCount/poCount)*100)}%)` : "–");
    setText("dash-per-overrideRate", poCount ? `${overrideCount} (${Math.round((overrideCount/poCount)*100)}%)` : "–");
    setText("dash-per-shipZb", poCount ? util.eur(shipZb) : "–");

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
