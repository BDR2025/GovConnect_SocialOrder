/* social_order_v0.20.3.0 · apps/cal_calendar (ESM)
   Personalisierter Kalender (Outlook-Feeling, aber minimal):
   Arbeitswoche · Woche · Monat · Agenda.

   Hinweis: Das ist ein Demo-Kalender für das GovConnect-Ökosystem.
   Er zeigt Zeit-/Abwesenheitsblöcke (Baseline + Deltas) und Prozess-Events (Deltas).
*/

export function mountCalendar(ctx){
  const {
    state,
    saveState,
    permissions,
    eventHub,
    escapeHtml,
    getCurrentUserId,
    getPersonById,
    navTo
  } = ctx;

  const root = document.getElementById("calendar-root");
  if(!root) return;

  // --------- date helpers (local, date-string first) ---------
  const pad2 = (n)=> String(n).padStart(2,'0');

  function todayStr(){
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }

  function parseDateStr(ds){
    // local midnight
    return new Date(`${ds}T00:00:00`);
  }

  function dateStrFromDate(d){
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }

  function addDays(ds, delta){
    const d = parseDateStr(ds);
    d.setDate(d.getDate() + delta);
    return dateStrFromDate(d);
  }

  function startOfWeekMonday(ds){
    const d = parseDateStr(ds);
    const wd = d.getDay(); // 0=So
    const diffToMon = (wd === 0 ? -6 : 1 - wd);
    d.setDate(d.getDate() + diffToMon);
    return dateStrFromDate(d);
  }

  function startOfMonth(ds){
    const d = parseDateStr(ds);
    d.setDate(1);
    return dateStrFromDate(d);
  }

  function addMonths(ds, delta){
    const d = parseDateStr(ds);
    d.setMonth(d.getMonth() + delta);
    // keep day-of-month safe
    return dateStrFromDate(d);
  }

  function isoZ(ds){
    // IMPORTANT: Do not use toISOString() on a local date object (timezone shift).
    return `${ds}T00:00:00.000Z`;
  }

  function fmtTime(ts){
    const d = new Date(ts);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function fmtDateShort(ds){
    const d = parseDateStr(ds);
    try{
      return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(d);
    }catch(_){
      return ds;
    }
  }

  function fmtDateLong(ds){
    const d = parseDateStr(ds);
    try{
      return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(d);
    }catch(_){
      return ds;
    }
  }

  function dayKeyFromTs(ts){
    const d = new Date(ts);
    return dateStrFromDate(d);
  }

  function buildUserOptions(meId){
    const p = typeof permissions === "function" ? permissions() : { userId: meId, user: null, roles: [] };

    // Option list: me + (if lead/approver) users from same dept
    const me = getPersonById(meId);
    const opts = [];
    opts.push({ id: meId, label: me ? me.name : "Ich" });

    if(me && Array.isArray(ctx.people)){
      const deptId = me.deptId || me.dept;
      const isLead = (p.roles || []).includes("lead") || (p.roles || []).includes("approver");
      if(isLead && deptId){
        const deptPeople = ctx.people.filter(x => x && (x.deptId || x.dept) === deptId);
        deptPeople.forEach(x=>{ if(x.id !== meId) opts.push({ id: x.id, label: x.name }); });
      }
    }

    // unique
    const seen = new Set();
    return opts.filter(o => (seen.has(o.id) ? false : (seen.add(o.id), true)));
  }

  function renderMiniMonth(activeDateStr){
    const base = activeDateStr ? parseDateStr(activeDateStr) : new Date();
    const y = base.getFullYear();
    const m = base.getMonth();
    const first = new Date(y, m, 1);
    // Monday-first
    const startW = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m+1, 0).getDate();

    const cells = [];
    for(let i=0;i<startW;i++) cells.push(null);
    for(let d=1; d<=daysInMonth; d++){
      cells.push(`${y}-${pad2(m+1)}-${pad2(d)}`);
    }

    const active = activeDateStr || todayStr();

    return `
      <div class="muted small">${escapeHtml(base.toLocaleString(undefined,{month:"long", year:"numeric"}))}</div>
      <div class="calMini">
        ${["Mo","Di","Mi","Do","Fr","Sa","So"].map(x=>`<div class="calMini__cell muted">${x}</div>`).join("")}
        ${cells.map(c=>{
          if(!c) return `<div class="calMini__cell"></div>`;
          const isActive = (c === active) ? "1" : "0";
          return `<button class="calMini__cell" data-cal-day="${escapeHtml(c)}" data-active="${isActive}">${escapeHtml(String(Number(c.slice(-2))))}</button>`;
        }).join("")}
      </div>
    `;
  }

  // --------- render helpers ---------
  function labelForBlockKind(kind){
    if(kind === "workday") return "Arbeitszeit";
    if(kind === "leave") return "Urlaub";
    if(kind === "sick") return "Abwesend";
    if(kind === "errand") return "Dienstgang";
    if(kind === "meeting") return "Termin";
    if(kind === "room") return "Raum";
    if(kind === "vehicle") return "Fahrzeug";
    return String(kind || "Block");
  }

  function renderAgenda({ days, items, showWorkday }){
    const map = new Map();
    for(const d of days) map.set(d, { blocks: [], events: [] });

    for(const b of (items.blocks || [])){
      if(!showWorkday && b && b.kind === "workday") continue;
      const dk = dayKeyFromTs(b.start);
      if(map.has(dk)) map.get(dk).blocks.push(b);
    }
    for(const ev of (items.events || [])){
      const dk = dayKeyFromTs(ev.ts);
      if(map.has(dk)) map.get(dk).events.push(ev);
    }

    let html = "";
    let any = false;

    for(const d of days){
      const g = map.get(d);
      const blocks = (g.blocks || []).slice().sort((a,b)=> new Date(a.start).getTime() - new Date(b.start).getTime());
      const events = (g.events || []).slice().sort((a,b)=> new Date(a.ts).getTime() - new Date(b.ts).getTime());
      if(blocks.length === 0 && events.length === 0) continue;
      any = true;

      html += `
        <div class="calSection">
          <div class="calSection__title">${escapeHtml(fmtDateLong(d))}</div>
          <div class="calList">
            ${blocks.map(b=>{
              const t = b.allDay ? "Ganztägig" : `${fmtTime(b.start)}–${fmtTime(b.end)}`;
              const label = labelForBlockKind(b.kind);
              const title = (b && typeof b.title === "string" && b.title.trim()) ? b.title.trim() : label;
              const room = (b && b.meta && (b.meta.roomName || b.meta.roomLabel)) ? String(b.meta.roomName || b.meta.roomLabel) : "";
              return `
                <div class="calItem">
                  <div class="calItem__time">${escapeHtml(t)}</div>
                  <div>
                    <div class="calItem__title">${escapeHtml(title)}</div>
                    <div class="calItem__meta">${room ? `<span class=\"calTag\">${escapeHtml(room)}</span> · ` : ""}<span class="calTag">Block</span></div>
                  </div>
                </div>
              `;
            }).join("")}

            ${events.map(ev=>{
              const t = fmtTime(ev.ts);
              const title = ev.title || ev.type || "Ereignis";
              const isSo = ev.subject && ev.subject.kind === "so" && ev.subject.id;
              const link = isSo
                ? `<a href="#/app/orders?open=${encodeURIComponent(ev.subject.id)}" data-open-order="${escapeHtml(ev.subject.id)}" class="calTag">SO öffnen</a>`
                : ``;
              const meta = isSo ? `SO · ${ev.subject.id}` : (ev.subject ? `${ev.subject.kind}` : "");
              return `
                <div class="calItem">
                  <div class="calItem__time">${escapeHtml(t)}</div>
                  <div>
                    <div class="calItem__title">${escapeHtml(title)}</div>
                    <div class="calItem__meta">${meta ? escapeHtml(meta) + " · " : ""}<span class="calTag">Event</span> ${link}</div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    if(!any){
      return `<div class="muted">Keine Einträge im gewählten Zeitraum.</div>`;
    }
    return html;
  }

  function layoutTimed(itemsTimed){
    // Greedy overlap layout (lightweight). Not perfect, but good enough for demo.
    const items = itemsTimed.slice().sort((a,b)=> a.startMin - b.startMin || a.endMin - b.endMin);
    const colEnds = [];
    const placed = [];
    for(const it of items){
      let col = -1;
      for(let i=0;i<colEnds.length;i++){
        if(it.startMin >= colEnds[i]){ col = i; break; }
      }
      if(col === -1){
        col = colEnds.length;
        colEnds.push(it.endMin);
      } else {
        colEnds[col] = it.endMin;
      }
      placed.push(Object.assign({}, it, { col }));
    }
    const cols = Math.max(1, Math.min(colEnds.length, 3));
    placed.forEach(p => { if(p.col >= cols) p.col = cols - 1; });
    return { cols, placed };
  }

  function renderWeekGrid({ days, items, view, showWorkday }){
    const showDays = (view === "workweek") ? days.slice(0,5) : days;

        // kompakter: Standard‑Arbeitszeitbereich; bei Bedarf später dynamisch.
    const startHour = 7;
    const endHour = 19;
    const hourHeight = 40; // px per hour (wird als CSS‑Variable gesetzt)
    const bodyHeight = (endHour - startHour) * hourHeight;
    const pxPerMin = hourHeight / 60;
    const minH = 16;

    function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

    function minutesOf(ts){
      const d = new Date(ts);
      return d.getHours()*60 + d.getMinutes();
    }

    function allDayFor(dayStr){
      return (items.blocks || []).filter(b => b && b.allDay && dayKeyFromTs(b.start) === dayStr);
    }

    function workdayFor(dayStr){
      if(!showWorkday) return [];
      return (items.blocks || []).filter(b => b && !b.allDay && b.kind === "workday" && dayKeyFromTs(b.start) === dayStr);
    }

    function timedFor(dayStr){
      const out = [];
      for(const b of (items.blocks || [])){
        if(!b || b.allDay) continue;
        // Arbeitszeit wird als Hintergrund dargestellt (nicht als Block)
        if(b.kind === "workday") continue;
        if(dayKeyFromTs(b.start) !== dayStr) continue;
        const s = minutesOf(b.start);
        const e = minutesOf(b.end);

        let title = labelForBlockKind(b.kind);
        let meta = `${fmtTime(b.start)}–${fmtTime(b.end)}`;

        // Meetings (Raumbuchung) dürfen einen eigenen Titel und eine Raumzeile tragen.
        if(b.kind === "meeting"){
          if(b.title && String(b.title).trim()) title = String(b.title).trim();
          const room = (b.meta && (b.meta.roomName || b.meta.roomLabel)) ? String(b.meta.roomName || b.meta.roomLabel) : "";
          if(room) meta = room;
        }

        out.push({
          kind: "block",
          blockKind: b.kind,
          title,
          meta,
          startMin: s,
          endMin: Math.max(s+10, e),
          openOrderId: null
        });
      }
      for(const ev of (items.events || [])){
        if(!ev || !ev.ts) continue;
        if(dayKeyFromTs(ev.ts) !== dayStr) continue;
        const s = minutesOf(ev.ts);
        // Ereignisse brauchen im Raster genügend Höhe, sonst wird der Text abgeschnitten.
        // 45 Minuten ist ein guter Kompromiss: sichtbar, aber nicht zu dominant.
        const e = s + 45;
        const isSo = ev.subject && ev.subject.kind === "so" && ev.subject.id;

        let title = ev.title || ev.type || "Ereignis";
        let meta = "Event";

        if(isSo){
          const soId = String(ev.subject.id);
          // Kompakt im Raster: Titel = SO‑Nummer, Meta = Status/Text
          const t = String(title || "");
          if(t.startsWith(soId)){
            const rest = t.slice(soId.length).replace(/^[:\s]+/,"").trim();
            title = soId;
            meta = rest || "Social Order";
          }else{
            title = soId;
            meta = t || "Social Order";
          }
        }

        out.push({
          kind: "event",
          blockKind: "event",
          title,
          meta,
          startMin: s,
          endMin: e,
          openOrderId: isSo ? String(ev.subject.id) : null
        });
      }
      return out;
    }

    const hourLabels = [];
    for(let h=startHour; h<endHour; h++) hourLabels.push(h);

    return `
      <div class="calWeek" style="--cal-days:${showDays.length};--cal-hour-h:${hourHeight}px;--cal-body-h:${bodyHeight}px">
        <div class="calWeek__hdr">
          <div class="calWeek__corner"></div>
          ${showDays.map(d=>`<div class="calWeek__hdrCell"><div class="calWeek__hdrDow">${escapeHtml(fmtDateShort(d))}</div><div class="calWeek__hdrDate">${escapeHtml(d.slice(-2))}</div></div>`).join("")}
        </div>

        <div class="calWeek__allday">
          <div class="calWeek__corner muted small">Ganztägig</div>
          ${showDays.map(d=>{
            const ads = allDayFor(d);
            return `
              <div class="calWeek__alldayCol">
                ${ads.map(b=>`<span class="calAllDayPill" data-kind="${escapeHtml(b.kind||"")}">${escapeHtml(labelForBlockKind(b.kind))}</span>`).join("")}
              </div>
            `;
          }).join("")}
        </div>

        <div class="calWeek__body">
          <div class="calWeek__times">
            ${hourLabels.map(h=>`<div class="calWeek__time">${escapeHtml(pad2(h)+":00")}</div>`).join("")}
          </div>
          <div class="calWeek__grid">
            ${showDays.map(d=>{
              const timed = timedFor(d);
              const { cols, placed } = layoutTimed(timed);

              const shades = workdayFor(d);
              const shadeHtml = shades.map(b=>{
                const sCl = clamp(minutesOf(b.start), startHour*60, endHour*60);
                const eCl = clamp(minutesOf(b.end), startHour*60, endHour*60);
                const top = (sCl - startHour*60) * pxPerMin;
                const h = Math.max(24, (eCl - sCl) * pxPerMin);
                return `<div class="calWorkShade" style="top:${top.toFixed(0)}px;height:${h.toFixed(0)}px;"></div>`;
              }).join("");

              const blocksHtml = shadeHtml + placed.map(it=>{
                const sCl = clamp(it.startMin, startHour*60, endHour*60);
                const eCl = clamp(it.endMin, startHour*60, endHour*60);
                const top = (sCl - startHour*60) * pxPerMin;
                const h = Math.max(minH, (eCl - sCl) * pxPerMin);
                const left = (it.col * (100/cols)) + 1;
                const width = (100/cols) - 2;
                const open = it.openOrderId ? ` data-open-order="${escapeHtml(it.openOrderId)}"` : "";
                const title = escapeHtml(it.title);
                const meta = escapeHtml(it.meta);
                return `
                  <div class="calBlock" data-kind="${escapeHtml(it.blockKind)}" style="top:${top.toFixed(0)}px;height:${h.toFixed(0)}px;left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;"${open}>
                    <div class="calBlock__title">${title}</div>
                    <div class="calBlock__meta">${meta}</div>
                  </div>
                `;
              }).join("");

              return `
                <div class="calWeek__day" data-cal-daycol="${escapeHtml(d)}">
                  <div class="calWeek__dayInner">${blocksHtml}</div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `;
  }

  function renderMonth({ focusDateStr, items }){
    const first = parseDateStr(startOfMonth(focusDateStr));
    const month = first.getMonth();
    const year = first.getFullYear();

    // calendar grid starts on Monday
    const firstW = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - firstW);

    const days = [];
    for(let i=0;i<42;i++){
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(dateStrFromDate(d));
    }

    // Build day counts (ignore workday blocks to reduce noise)
    const countByDay = new Map();
    for(const ds of days) countByDay.set(ds, { blocks: 0, events: 0, flags: new Set() });

    for(const b of (items.blocks || [])){
      const dk = dayKeyFromTs(b.start);
      if(!countByDay.has(dk)) continue;
      if(b.kind === "workday") continue;
      const c = countByDay.get(dk);
      c.blocks += 1;
      c.flags.add(String(b.kind||"block"));
    }

    for(const ev of (items.events || [])){
      const dk = dayKeyFromTs(ev.ts);
      if(!countByDay.has(dk)) continue;
      const c = countByDay.get(dk);
      c.events += 1;
      c.flags.add("event");
    }

    const monthLabel = (()=>{
      try{ return new Intl.DateTimeFormat('de-DE',{month:'long', year:'numeric'}).format(first); }catch(_){ return `${pad2(month+1)}.${year}`; }
    })();

    return `
      <div class="calMonth">
        <div class="calMonth__title">${escapeHtml(monthLabel)}</div>
        <div class="calMonth__hdr">
          ${["Mo","Di","Mi","Do","Fr","Sa","So"].map(x=>`<div class="calMonth__hdrCell muted small">${x}</div>`).join("")}
        </div>
        <div class="calMonth__grid">
          ${days.map(ds=>{
            const d = parseDateStr(ds);
            const out = (d.getMonth() !== month) ? "1" : "0";
            const c = countByDay.get(ds) || { blocks: 0, events: 0, flags: new Set() };
            const dots = Array.from(c.flags).slice(0,4);
            return `
              <button class="calMonth__cell" data-cal-day="${escapeHtml(ds)}" data-out="${out}">
                <div class="calMonth__num">${escapeHtml(String(Number(ds.slice(-2))))}</div>
                <div class="calMonth__marks">
                  ${dots.map(k=>`<span class="calDot" data-kind="${escapeHtml(k)}"></span>`).join("")}
                </div>
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function computeRange(view, focusDateStr){
    if(view === "month"){
      const m0 = startOfMonth(focusDateStr);
      const m1 = startOfMonth(addMonths(m0, 1));
      return {
        startDateStr: m0,
        endDateStr: m1,
        startIso: isoZ(m0),
        endIso: isoZ(m1),
        days: []
      };
    }

    const mon = startOfWeekMonday(focusDateStr);
    const nextMon = addDays(mon, 7);
    const days = [];
    for(let i=0;i<7;i++) days.push(addDays(mon, i));
    return {
      startDateStr: mon,
      endDateStr: nextMon,
      startIso: isoZ(mon),
      endIso: isoZ(nextMon),
      days
    };
  }

  function render(){
    const meId = (typeof getCurrentUserId === "function") ? getCurrentUserId() : (state.session && state.session.userId);
    if(!state.ui) state.ui = {};
    if(!state.ui.calendar) state.ui.calendar = {};

    if(!state.ui.calendar.view) state.ui.calendar.view = "workweek";
    if(!state.ui.calendar.focusDate) state.ui.calendar.focusDate = todayStr();
    // Kalender folgt immer der aktuellen Session‑Persona (kein Personen‑Dropdown).
    state.ui.calendar.selectedUserId = meId;

    const caps = (typeof permissions === "function") ? permissions() : { isCentral: false };
    const isCentral = !!(caps && caps.isCentral);
    if(!state.ui.calendar.soScope){
      // Default: ZB startet im persönlichen Modus, um den eigenen Kalender nicht zu überladen.
      state.ui.calendar.soScope = isCentral ? "mine" : "scope";
    }


    // Layer / Anzeige‑Optionen (skalierbar für spätere Apps: Räume/Fahrzeuge/Zeiterfassung …)
    if(!state.ui.calendar.layers) state.ui.calendar.layers = {};
    const layers = state.ui.calendar.layers;
    // Wichtig: Viele Nutzer hatten in früheren Builds Layer‑States im localStorage.
    // Beim Upgrade initialisieren wir die Layer EINMAL neu, damit der Kalender nicht "leer" wirkt.
    if(state.ui.calendar._layersInit !== "v0.20.4"){
      layers.workday = true;
      layers.so = true;
      layers.meeting = true;
      state.ui.calendar._layersInit = "v0.20.4";
    }

    if(typeof layers.workday !== "boolean") layers.workday = true; // Arbeitszeit (Hintergrund)
    if(typeof layers.so !== "boolean") layers.so = true;           // Social‑Order‑Events
    if(typeof layers.meeting !== "boolean") layers.meeting = true; // Raumbuchung (Terminblöcke)

    const view = state.ui.calendar.view;
    const focus = state.ui.calendar.focusDate;
    const range = computeRange(view, focus);

    const itemsRaw = eventHub.getCalendarItems({
      startIso: range.startIso,
      endIso: range.endIso,
      userId: meId,
      // View ist immer der aktuelle Nutzer (Session)
      selectedUserId: meId,
      view
    });

    function findOrderById(id){
      const key = String(id || "");
      if(!key) return null;
      const a = (state.orders || []).find(o => o && String(o.id) === key);
      if(a) return a;
      const h = (state.historyOrders || []).find(o => o && String(o.id) === key);
      return h || null;
    }

    function applySoScope(items){
      if(!items || !Array.isArray(items.events)) return items;
      if(!isCentral) return items;
      const mode = String(state.ui.calendar.soScope || "mine");
      if(mode !== "mine") return items;

      const me = String(meId);
      const evs = items.events.filter(ev => {
        const isSo = ev && ev.subject && ev.subject.kind === "so" && ev.subject.id;
        if(!isSo) return true;
        const o = findOrderById(ev.subject.id);
        // Im persönlichen Modus: nur SO-Vorgänge, die ich selbst angelegt habe (ownerId).
        return !!(o && o.ownerId && String(o.ownerId) === me);
      });
      return Object.assign({}, items, { events: evs });
    }

    let items = applySoScope(itemsRaw);

    // Layer: Social Order (Events) – ausblendbar
    if(layers && layers.so === false){
      items = Object.assign({}, items, {
        events: (items.events || []).filter(ev => !(ev && ev.subject && ev.subject.kind === "so"))
      });
    }

    // Layer: Raumbuchung (Meeting-Blöcke) – ausblendbar
    if(layers && layers.meeting === false){
      items = Object.assign({}, items, {
        blocks: (items.blocks || []).filter(b => !(b && b.kind === "meeting"))
      });
    }

    const targetPerson = getPersonById(meId);
    const titleName = targetPerson ? targetPerson.name : "Kalender";

    // Period label
    const periodLabel = (()=>{
      if(view === "month") return fmtDateLong(startOfMonth(focus));
      const endDay = addDays(range.startDateStr, 6);
      return `${fmtDateLong(range.startDateStr)} – ${fmtDateLong(endDay)}`;
    })();

    const soScopeTag = isCentral ? (state.ui.calendar.soScope === "scope" ? "ZB" : "Mein") : "";

    root.innerHTML = `
      <div class="pageTitle">
        <div>
          <div class="pageTitle__eyebrow">GovConnect</div>
          <div class="pageTitle__title">Kalender</div>
        </div>
        <div class="pageTitle__actions">
          <a class="btn" href="#/raumbuchung">Raumbuchung</a>
          <a class="btn" href="#/app/orders">Social Order</a>
        </div>
      </div>

      <div class="cal">
        <div class="cal__side">
          <div class="calToolbar" style="margin-bottom:0;">
            <div class="calToolbar__left">
              <button class="btn" data-cal-today="1">Heute</button>
            </div>
          </div>
          ${renderMiniMonth(focus)}

          <div class="calFilters">
            <div>
              <label>Kalender</label>
              <div class="calStatic">${escapeHtml(titleName)}</div>
            </div>

            <div>
              <label>Anzeige</label>
              <div class="calChecks">
                <label class="calCheck"><input type="checkbox" id="cal-layer-workday" ${layers.workday ? "checked" : ""}/> Arbeitszeit</label>
                <label class="calCheck"><input type="checkbox" id="cal-layer-meeting" ${layers.meeting ? "checked" : ""}/> Raumbuchung</label>
                <label class="calCheck"><input type="checkbox" id="cal-layer-so" ${layers.so ? "checked" : ""}/> Social Order</label>
              </div>
            </div>

            ${isCentral ? `
            <div>
              <label for="cal-so-scope">Social Order</label>
              <select id="cal-so-scope">
                <option value="mine" ${state.ui.calendar.soScope==="mine"?"selected":""}>Persönlich</option>
                <option value="scope" ${state.ui.calendar.soScope==="scope"?"selected":""}>ZB‑Kalender (alle)</option>
              </select>
            </div>
            ` : ""}

            <div>
              <label>Hinweis</label>
              <div class="muted small">SO‑Events folgen dem gleichen Sichtbarkeits‑Scope wie <strong>„Meine Anforderungen“</strong> in Social Order. ZB kann zusätzlich zwischen <em>Persönlich</em> und <em>ZB‑Kalender</em> wechseln. <strong>Raumbuchung</strong> zeigt Terminblöcke aus der Raumbuchungs‑App.</div>
            </div>
          </div>
        </div>

        <div class="cal__main">
          <div class="calToolbar">
            <div class="calToolbar__left">
              <button class="btn" data-cal-prev="1">◀</button>
              <button class="btn" data-cal-next="1">▶</button>
              <div class="calPill">
                <span class="calTag">${escapeHtml(viewLabel(view))}</span>
                ${soScopeTag ? `<span class="calTag">${escapeHtml(soScopeTag)}</span>` : ""}
                <span>${escapeHtml(titleName)}</span>
              </div>
              <div class="muted small">${escapeHtml(periodLabel)}</div>
            </div>
            <div class="calToolbar__right">
              <div class="calTabs">
                ${renderViewBtn("workweek","Arbeitswoche", view)}
                ${renderViewBtn("week","Woche", view)}
                ${renderViewBtn("month","Monat", view)}
                ${renderViewBtn("agenda","Agenda", view)}
              </div>
            </div>
          </div>

          <div class="calContent">
            ${renderMainContent({ view, range, items, focusDateStr: focus, layers })}
          </div>
        </div>
      </div>
    `;

    // bind: today
    const btnToday = root.querySelector("[data-cal-today]");
    if(btnToday) btnToday.addEventListener("click", ()=>{ state.ui.calendar.focusDate = todayStr(); saveState(); render(); });

    // bind: prev/next
    const prev = root.querySelector("[data-cal-prev]");
    const next = root.querySelector("[data-cal-next]");
    if(prev) prev.addEventListener("click", ()=> shift(-1));
    if(next) next.addEventListener("click", ()=> shift(1));

    // bind: mini month click
    root.querySelectorAll("[data-cal-day]").forEach(b=>{
      b.addEventListener("click", ()=>{
        const d = b.getAttribute("data-cal-day");
        if(d){ state.ui.calendar.focusDate = d; saveState(); render(); }
      });
    });

    // bind: Layer toggles (Arbeitszeit/Raumbuchung/Social Order)
    const cbWork = root.querySelector("#cal-layer-workday");
    if(cbWork){
      cbWork.addEventListener("change", ()=>{
        state.ui.calendar.layers = state.ui.calendar.layers || {};
        state.ui.calendar.layers.workday = !!cbWork.checked;
        saveState();
        render();
      });
    }

    const cbSo = root.querySelector("#cal-layer-so");
    if(cbSo){
      cbSo.addEventListener("change", ()=>{
        state.ui.calendar.layers = state.ui.calendar.layers || {};
        state.ui.calendar.layers.so = !!cbSo.checked;
        saveState();
        render();
      });
    }

    const cbMeet = root.querySelector("#cal-layer-meeting");
    if(cbMeet){
      cbMeet.addEventListener("change", ()=>{
        state.ui.calendar.layers = state.ui.calendar.layers || {};
        state.ui.calendar.layers.meeting = !!cbMeet.checked;
        saveState();
        render();
      });
    }

    // bind: SO scope (nur ZB)
    const soSel = root.querySelector("#cal-so-scope");
    if(soSel){
      soSel.addEventListener("change", ()=>{
        state.ui.calendar.soScope = soSel.value;
        saveState();
        render();
      });
    }

    // bind: view buttons
    root.querySelectorAll("[data-cal-view]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const v = btn.getAttribute("data-cal-view");
        if(v){
          state.ui.calendar.view = v;
          saveState();
          render();
        }
      });
    });

    // bind: open order (agenda + grid)
    root.querySelectorAll("[data-open-order]").forEach(el=>{
      el.addEventListener("click", (ev)=>{
        ev.preventDefault();
        const id = el.getAttribute("data-open-order");
        if(id) navTo(`#/app/orders?open=${encodeURIComponent(id)}`);
      });
    });
  }

  function viewLabel(view){
    if(view === "workweek") return "Arbeitswoche";
    if(view === "week") return "Woche";
    if(view === "month") return "Monat";
    if(view === "agenda") return "Agenda";
    return "Kalender";
  }

  function renderViewBtn(view, label, activeView){
    const cls = (view === activeView) ? "btn btn--primary" : "btn";
    return `<button class="${cls}" data-cal-view="${escapeHtml(view)}">${escapeHtml(label)}</button>`;
  }

  function renderMainContent({ view, range, items, focusDateStr, layers }){
    if(view === "month"){
      return renderMonth({ focusDateStr, items });
    }

    // week/workweek/agenda share the same week range
    const days = range.days || [];
    if(view === "agenda"){
      return renderAgenda({
        days: days,
        items,
        showWorkday: !!(layers && layers.workday)
      });
    }

    return renderWeekGrid({
      days,
      items,
      view,
      showWorkday: !!(layers && layers.workday)
    });
  }

  function shift(dir){
    const view = state.ui.calendar.view || "workweek";
    const focus = state.ui.calendar.focusDate || todayStr();

    if(view === "month"){
      const d = parseDateStr(focus);
      d.setMonth(d.getMonth() + dir);
      state.ui.calendar.focusDate = dateStrFromDate(d);
      saveState();
      render();
      return;
    }

    // week-based shift by 7 days
    state.ui.calendar.focusDate = addDays(focus, dir * 7);
    saveState();
    render();
  }

  render();
}
