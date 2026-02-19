/* social_order_v0.20.3.5 · apps/rb_rooms (ESM)
   Raumbuchung (Demo)

   Persistenz:
   - Raumbelegung wird als Block in state.gcBlocksDelta gespeichert (kind:"room").
     ownerId = `room:<roomId>` → Ressource als „virtueller Owner“.
   - Zusätzlich wird je Person ein Kalenderblock erzeugt (kind:"meeting").

   Wichtige Demo-Annahmen:
   - Alle Mitarbeitenden dürfen alle Räume buchen ("frei ist frei").
   - Konflikte werden über die Raumblöcke geprüft.
   - Kommunikation (Chat/Telefon/Video) bleibt Darstellung.
*/

import { escapeHtml } from "../core/utils.js";

function pad2(n){ return String(n).padStart(2, "0"); }

function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function parseLocalDateTimeToIso(dateStr, timeStr){
  // Input ohne Timezone wird als lokale Zeit interpretiert.
  const t = String(timeStr || "").trim() || "09:00";
  const d = new Date(`${dateStr}T${t}:00`);
  return d.toISOString();
}

function addMinutesIso(startIso, minutes){
  const d = new Date(startIso);
  d.setMinutes(d.getMinutes() + Number(minutes || 0));
  return d.toISOString();
}

function intersects(startA, endA, startB, endB){
  const a0 = new Date(startA).getTime();
  const a1 = new Date(endA).getTime();
  const b0 = new Date(startB).getTime();
  const b1 = new Date(endB).getTime();
  if(Number.isNaN(a0) || Number.isNaN(a1) || Number.isNaN(b0) || Number.isNaN(b1)) return false;
  return a0 < b1 && b0 < a1;
}

function fmtDate(ts){
  const d = new Date(ts);
  if(Number.isNaN(d.getTime())) return "–";
  try{ return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }).format(d); }
  catch(_){ return d.toLocaleDateString(); }
}

function fmtTime(ts){
  const d = new Date(ts);
  if(Number.isNaN(d.getTime())) return "–";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtRange(startIso, endIso){
  return `${fmtDate(startIso)} · ${fmtTime(startIso)}–${fmtTime(endIso)}`;
}

function dateStrFromIso(iso){
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return todayStr();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function uniqStrings(arr){
  const out = [];
  const seen = new Set();
  (arr || []).forEach(x=>{
    const s = String(x || "").trim();
    if(!s) return;
    if(seen.has(s)) return;
    seen.add(s);
    out.push(s);
  });
  return out;
}

function newBookingId(){
  return `RB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`.toUpperCase();
}

function ensureUi(state){
  if(!state.ui) state.ui = {};
  if(!state.ui.rooms){
    state.ui.rooms = {
      // gemeinsames Zeitfenster für Schnellbuchung & Finder
      date: todayStr(),
      start: "14:00",
      duration: 120,

      // Schnellbuchung
      quickRoomId: "",

      // Finder
      houseId: "all",
      minCap: "",
      q: "",
      equip: [],
      equipOpen: false,

      // Feedback
      lastBookingId: ""
    };
  }

  // Backwards-/forwards-compat: fehlende Keys ergänzen
  const ui = state.ui.rooms;
  if(!ui.date) ui.date = todayStr();
  if(!ui.start) ui.start = "14:00";
  if(typeof ui.duration !== "number" || !isFinite(ui.duration)) ui.duration = 120;
  if(typeof ui.quickRoomId !== "string") ui.quickRoomId = "";
  if(!ui.houseId) ui.houseId = "all";
  if(typeof ui.minCap !== "string") ui.minCap = String(ui.minCap || "");
  if(typeof ui.q !== "string") ui.q = String(ui.q || "");
  if(!Array.isArray(ui.equip)) ui.equip = [];
  if(typeof ui.equipOpen !== "boolean") ui.equipOpen = false;
  if(typeof ui.lastBookingId !== "string") ui.lastBookingId = "";

  return ui;
}

export function mountRoomBooking(ctx){
  const {
    state,
    saveState,
    openModal,
    closeModal,
    eventHub,
    rooms,
    houses,
    seatingOptions,
    people,
    getCurrentUserId,
    getPersonById,
    navTo
  } = ctx;

  const root = document.getElementById("rb-root");
  if(!root) return;

  const ui = ensureUi(state);

  const ROOMS = Array.isArray(rooms) ? rooms : [];
  const HOUSES = Array.isArray(houses) ? houses : [];
  const HOUSE_BY_ID = Object.fromEntries(HOUSES.map(h => [String(h.id), h]));

  function roomById(roomId){
    const rid = String(roomId || "");
    return ROOMS.find(r => r && String(r.id) === rid) || null;
  }

  function houseById(houseId){
    return HOUSE_BY_ID[String(houseId || "")] || null;
  }

  function roomImageUrl(r){
    if(r && r.image) return `assets/img/rooms/${encodeURIComponent(String(r.image))}`;
    return "assets/img/exempla-wappen.png";
  }

  function roomLocationLine(r){
    if(!r) return "–";
    const h = houseById(r.houseId);
    const houseLabel = h ? h.label : (r.houseId || "Haus");
    const line = r.locationLine ? String(r.locationLine) : "";
    return line ? `${houseLabel} · ${line}` : houseLabel;
  }

  function seatingLabel(key){
    const k = String(key || "");
    const opt = (seatingOptions || []).find(x => x && String(x.key) === k);
    return opt ? String(opt.label) : (k || "–");
  }

  function computeRange(){
    const date = String(ui.date || "").trim();
    const start = String(ui.start || "").trim();
    const dur = Number(ui.duration || 0);
    if(!date || !start || !dur) return { startIso: "", endIso: "" };
    const startIso = parseLocalDateTimeToIso(date, start);
    const endIso = addMinutesIso(startIso, dur);
    return { startIso, endIso };
  }

  function goToCalendar(iso){
    try{
      if(!state.ui) state.ui = {};
      if(!state.ui.calendar) state.ui.calendar = {};
      state.ui.calendar.focusDate = dateStrFromIso(iso);
      // Kalender-Layer (Meeting/Room) sind in der Demo generell aktivierbar.
      // Wir ändern hier bewusst keine Layer, damit der Nutzer seine Sicht behält.
      if(typeof saveState === "function") saveState();
    }catch(_){ /* noop */ }
    if(typeof navTo === "function") navTo("/kalender");
    else location.hash = "#/kalender";
  }

  function openRoomDetailsModal({ room, startIso, endIso, meId }){
    if(!room) return;
    const house = houseById(room.houseId);
    const equipmentHtml = (room.equipment || []).map(t => `<span class="pill rbPill">${escapeHtml(t)}</span>`).join("");

    const rangeReady = !!(startIso && endIso);
    const free = rangeReady ? isRoomFree(room.id, startIso, endIso) : true;
    const c = (!free && rangeReady) ? firstConflict(room.id, startIso, endIso) : null;

    const availabilityCallout = rangeReady ? (free ? `
      <div class="callout" style="margin-top:12px;">
        <div class="callout__title">Frei im gewählten Zeitfenster</div>
        <div class="callout__text">${escapeHtml(fmtRange(startIso, endIso))}</div>
      </div>
    ` : `
      <div class="callout callout--warn" style="margin-top:12px;">
        <div class="callout__title">Nicht verfügbar</div>
        <div class="callout__text">Der Raum ist belegt${c ? `: ${escapeHtml(fmtRange(c.start, c.end))}` : "."}</div>
      </div>
    `) : ``;

    openModal(`
      <div class="rbRoomDetail" data-rb-detail="1" data-room-id="${escapeHtml(room.id)}">
        <img class="rbRoomDetail__img" src="${escapeHtml(roomImageUrl(room))}" alt="${escapeHtml(room.name)}" />
        <div style="margin-top:10px;">
          <div class="roomModal__heroTitle">${escapeHtml(room.name)}</div>
          <div class="muted">${escapeHtml(roomLocationLine(room))} · ${escapeHtml(String(room.capacity || "–"))} Pers.</div>
          <div style="margin-top:10px;">${equipmentHtml}</div>
        </div>

        <div class="divider"></div>

        <div class="muted">${escapeHtml(String(room.info || ""))}</div>

        ${availabilityCallout}

        <div class="row" style="justify-content:flex-end; gap:10px; margin-top:12px;">
          <button class="btn" type="button" data-rb-detail-close="1">Schließen</button>
          <button class="btn btn--primary" type="button" data-rb-detail-book="1" ${(!rangeReady || !free) ? "disabled" : ""}>Buchen</button>
        </div>
      </div>
    `, { title: "Raum" });

    const body = document.getElementById("modal-body");
    const wrap = body ? body.querySelector("[data-rb-detail='1']") : null;
    if(!wrap) return;

    const btnClose = wrap.querySelector("[data-rb-detail-close]");
    if(btnClose) btnClose.addEventListener("click", ()=>{ if(typeof closeModal === "function") closeModal(); });

    const btnBook = wrap.querySelector("[data-rb-detail-book]");
    if(btnBook) btnBook.addEventListener("click", ()=>{
      if(!rangeReady) return;
      if(!isRoomFree(room.id, startIso, endIso)) return;
      openBookingModal({ room, startIso, endIso, meId });
    });
  }

  function roomBlocks(roomId){
    const rid = String(roomId || "");
    return (state.gcBlocksDelta || [])
      .filter(b => b && b.kind === "room")
      .filter(b => String(b.roomId || "") === rid)
      .filter(b => String(b.status || "").toLowerCase() !== "cancelled");
  }

  function isRoomFree(roomId, startIso, endIso){
    if(!startIso || !endIso) return false;
    return !roomBlocks(roomId).some(b => intersects(b.start, b.end, startIso, endIso));
  }

  function firstConflict(roomId, startIso, endIso){
    if(!startIso || !endIso) return null;
    const list = roomBlocks(roomId)
      .filter(b => intersects(b.start, b.end, startIso, endIso))
      .sort((a,b)=> new Date(a.start).getTime() - new Date(b.start).getTime());
    return list[0] || null;
  }

  function allEquipTags(){
    const tags = [];
    ROOMS.forEach(r => {
      (r && Array.isArray(r.equipment) ? r.equipment : []).forEach(t => tags.push(String(t)));
    });
    return uniqStrings(tags).sort((a,b)=> a.localeCompare(b, "de"));
  }

  function matchesEquip(room, selected){
    const sel = Array.isArray(selected) ? selected.map(String) : [];
    if(!sel.length) return true;
    const eq = (room && Array.isArray(room.equipment) ? room.equipment : []).map(String);
    // AND-Logik: alle ausgewählten Tags müssen vorhanden sein
    return sel.every(t => eq.includes(t));
  }

  function filterRooms(){
    const houseId = String(ui.houseId || "all");
    const q = String(ui.q || "").trim().toLowerCase();
    const minCap = Number(String(ui.minCap || "").trim() || 0);
    const selectedEquip = Array.isArray(ui.equip) ? ui.equip : [];

    return ROOMS.filter(r => {
      if(!r) return false;
      if(houseId !== "all" && String(r.houseId) !== houseId) return false;
      if(minCap && Number(r.capacity || 0) < minCap) return false;
      if(q){
        const hay = `${r.name||""} ${r.type||""} ${r.locationLine||""} ${(r.equipment||[]).join(" ")} ${(r.info||"")}`.toLowerCase();
        if(!hay.includes(q)) return false;
      }
      if(!matchesEquip(r, selectedEquip)) return false;
      return true;
    }).sort((a,b)=> String(a.name||"").localeCompare(String(b.name||""), "de"));
  }

  function myUpcomingBookings(meId){
    const now = Date.now();
    const list = (state.gcBlocksDelta || [])
      .filter(b => b && b.kind === "meeting")
      .filter(b => String(b.ownerId || "") === String(meId || ""))
      .filter(b => b.meta && b.meta.source === "roomBooking")
      .filter(b => String(b.status || "").toLowerCase() !== "cancelled")
      .filter(b => new Date(b.end).getTime() >= now)
      .sort((a,b)=> new Date(a.start).getTime() - new Date(b.start).getTime());
    // dedupe by bookingId (meeting blocks might be duplicated for same owner if buggy)
    const seen = new Set();
    return list.filter(b => {
      const k = String(b.bookingId || b.subject?.id || b.id);
      if(!k) return true;
      if(seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function cancelBooking(bookingId, meId){
    const bid = String(bookingId || "");
    if(!bid) return;
    const nowIso = new Date().toISOString();
    (state.gcBlocksDelta || []).forEach(b => {
      if(!b) return;
      const bId = String(b.bookingId || b.subject?.id || "");
      if(bId !== bid) return;
      b.status = "cancelled";
      b.cancelledAt = nowIso;
      b.cancelledBy = String(meId || "");
    });
    saveState();
  }

  function createBooking({ room, startIso, endIso, title, seatingKey, note, inviteeIds, organizerId }){
    const bid = newBookingId();

    const house = houseById(room.houseId);
    const where = `${room.name} · ${roomLocationLine(room)}`;
    const equipment = Array.isArray(room.equipment) ? room.equipment.slice() : [];

    // 1) Raumblock (Ressource)
    eventHub.createBlock({
      ownerId: `room:${room.id}`,
      kind: "room",
      roomId: room.id,
      bookingId: bid,
      start: startIso,
      end: endIso,
      allDay: false,
      status: "booked",
      createdBy: organizerId,
      visibility: { mode: "owner" },
      title: `Raum belegt: ${room.name}`,
      location: where,
      meta: {
        source: "roomBooking",
        organizerId,
        houseId: room.houseId,
        houseLabel: house ? house.label : "",
        roomName: room.name,
        seating: seatingKey,
        equipment,
        note: note || "",
        invitees: inviteeIds
      },
      dedupeKey: `rb|${bid}|room|${room.id}`,
      subject: { kind: "rb", id: bid }
    });

    // 2) Kalenderblöcke (Bucher + Eingeladene)
    const participants = uniqStrings([organizerId].concat(inviteeIds || []));
    const displayTitle = title ? String(title) : room.name;

    participants.forEach(pid => {
      eventHub.createBlock({
        ownerId: pid,
        kind: "meeting",
        roomId: room.id,
        bookingId: bid,
        start: startIso,
        end: endIso,
        allDay: false,
        status: "booked",
        createdBy: organizerId,
        visibility: { mode: "ownerAndLeads" },
        title: displayTitle,
        location: where,
        meta: {
          source: "roomBooking",
          bookingId: bid,
          organizerId,
          roomId: room.id,
          roomName: room.name,
          houseId: room.houseId,
          seating: seatingKey,
          equipment,
          note: note || "",
          participants
        },
        dedupeKey: `rb|${bid}|meeting|${pid}`,
        subject: { kind: "rb", id: bid }
      });
    });

    ui.lastBookingId = bid;
    saveState();
    return bid;
  }

  function openBookingModal({ room, startIso, endIso, meId }){
    const rangeLabel = fmtRange(startIso, endIso);
    const house = houseById(room.houseId);

    const seatMode = room.seating && room.seating.mode ? String(room.seating.mode) : "fixed";
    const seatDefault = room.seating && room.seating.default ? String(room.seating.default) : "";
    const seatOptions = room.seating && Array.isArray(room.seating.options) ? room.seating.options : [];

    // Invite list
    const ppl = Array.isArray(people) ? people.filter(p => p && p.id) : [];
    ppl.sort((a,b)=> String(a.name||"").localeCompare(String(b.name||""), "de"));

    const inviteOptions = ppl
      .filter(p => String(p.id) !== String(meId))
      .map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}${p.unitLabel ? " · " + escapeHtml(p.unitLabel) : ""}</option>`)
      .join("");

    const equipmentHtml = (room.equipment || []).map(t => `<span class="pill rbPill">${escapeHtml(t)}</span>`).join("");

    openModal(`
      <div class="rbModal" data-rb-modal="1" data-room-id="${escapeHtml(room.id)}">
        <div class="rbModal__head">
          <div class="rbModal__img">
            <img src="${escapeHtml(roomImageUrl(room))}" alt="${escapeHtml(room.name)}" />
          </div>
          <div class="rbModal__meta">
            <div class="rbModal__title">${escapeHtml(room.name)}</div>
            <div class="muted">${escapeHtml(house ? house.label : "")} · ${escapeHtml(room.locationLine || "")} · ${escapeHtml(String(room.capacity || "–"))} Pers.</div>
            <div class="muted" style="margin-top:6px;"><strong>${escapeHtml(rangeLabel)}</strong></div>
            <div style="margin-top:10px;">${equipmentHtml}</div>
          </div>
        </div>

        <div class="divider"></div>

        <div class="rbForm">
          <div>
            <label class="label" for="rb-title">Titel</label>
            <input id="rb-title" type="text" value="${escapeHtml(room.name)}" />
          </div>

          <div>
            <label class="label" for="rb-invite">Teilnehmende einladen</label>
            <input id="rb-invite-q" type="search" placeholder="Suchen …" style="margin-bottom:8px;" />
            <select id="rb-invite" multiple size="8">${inviteOptions}</select>
            <div class="muted small" id="rb-invite-meta" style="margin-top:6px;">Eingeladene erhalten eine Kopie im persönlichen Kalender.</div>
          </div>

          ${seatMode === "selectable" ? `
            <div>
              <label class="label" for="rb-seating">Bestuhlung</label>
              <select id="rb-seating">
                ${seatOptions.map(k => `<option value="${escapeHtml(k)}" ${String(k)===seatDefault?"selected":""}>${escapeHtml(seatingLabel(k))}</option>`).join("")}
              </select>
              <div class="muted small" style="margin-top:6px;">Standard: ${escapeHtml(seatingLabel(seatDefault))}</div>
            </div>
          ` : `
            <div>
              <label class="label">Bestuhlung</label>
              <input type="text" value="${escapeHtml(seatingLabel(seatDefault))}" readonly />
            </div>
          `}

          <div>
            <label class="label" for="rb-note">Notiz</label>
            <textarea id="rb-note" rows="3" placeholder="optional …"></textarea>
          </div>
        </div>

        <div id="rb-modal-msg" style="margin-top:12px;"></div>

        <div class="callout" style="margin-top:12px;">
          <div class="callout__title">Demo‑Hinweis</div>
          <div class="callout__text">Der Raum wird als Block im Systemkalender geführt. Chat/Telefon/Video sind bewusst nicht implementiert.</div>
        </div>

        <div class="row" style="justify-content:flex-end; gap:10px; margin-top:12px;">
          <button class="btn" type="button" data-rb-cancel="1">Abbrechen</button>
          <button class="btn btn--primary" type="button" data-rb-save="1">Buchen</button>
        </div>
      </div>
    `, { title: "Raum buchen" });

    const body = document.getElementById("modal-body");
    if(!body) return;
    const wrap = body.querySelector("[data-rb-modal='1']");
    if(!wrap) return;

    const btnCancel = wrap.querySelector("[data-rb-cancel]");
    if(btnCancel) btnCancel.addEventListener("click", ()=>{ if(typeof closeModal === "function") closeModal(); });

    const inviteEl = wrap.querySelector("#rb-invite");
    const inviteQ = wrap.querySelector("#rb-invite-q");
    const inviteMeta = wrap.querySelector("#rb-invite-meta");
    const msgBox = wrap.querySelector("#rb-modal-msg");

    function updateInviteMeta(){
      if(!inviteEl || !inviteMeta) return;
      const n = (inviteEl.selectedOptions || []).length;
      inviteMeta.textContent = `${n} ausgewählt · Eingeladene erhalten eine Kopie im persönlichen Kalender.`;
    }

    function applyInviteFilter(){
      if(!inviteEl || !inviteQ) return;
      const q = String(inviteQ.value || "").trim().toLowerCase();
      Array.from(inviteEl.options || []).forEach(opt => {
        if(!q){ opt.hidden = false; return; }
        if(opt.selected){ opt.hidden = false; return; }
        opt.hidden = !String(opt.textContent || "").toLowerCase().includes(q);
      });
    }

    if(inviteEl){
      inviteEl.addEventListener("change", ()=>{ updateInviteMeta(); applyInviteFilter(); });
      updateInviteMeta();
    }
    if(inviteQ){
      inviteQ.addEventListener("input", ()=>{ applyInviteFilter(); });
      applyInviteFilter();
    }

    const btnSave = wrap.querySelector("[data-rb-save]");
    if(btnSave){
      btnSave.addEventListener("click", ()=>{
        // re-check availability (race condition safe)
        if(!isRoomFree(room.id, startIso, endIso)){
          const c = firstConflict(room.id, startIso, endIso);
          const msg = c ? `Raum ist leider belegt (${fmtRange(c.start, c.end)}).` : "Raum ist leider belegt.";
          if(msgBox){
            msgBox.innerHTML = `<div class="callout callout--warn"><div class="callout__title">Nicht verfügbar</div><div class="callout__text">${escapeHtml(msg)}</div></div>`;
          }
          return;
        }

        const titleEl = wrap.querySelector("#rb-title");
        const noteEl = wrap.querySelector("#rb-note");
        const seatEl = wrap.querySelector("#rb-seating");
        const title = titleEl ? String(titleEl.value || "").trim() : "";
        const note = noteEl ? String(noteEl.value || "").trim() : "";
        const seatingKey = seatEl ? String(seatEl.value || seatDefault) : seatDefault;

        const inviteeIds = inviteEl
          ? Array.from(inviteEl.selectedOptions || []).map(o => String(o.value || "")).filter(Boolean)
          : [];

        createBooking({
          room,
          startIso,
          endIso,
          title,
          seatingKey,
          note,
          inviteeIds,
          organizerId: String(meId || "")
        });

        if(typeof closeModal === "function") closeModal();
        render();
      });
    }
  }

  function render(){
    const meId = typeof getCurrentUserId === "function" ? getCurrentUserId() : (state.session && state.session.userId);
    const me = meId ? getPersonById(meId) : null;

    const { startIso, endIso } = computeRange();
    const rangeReady = !!(startIso && endIso);

    const equipTags = allEquipTags();
    const equipSelected = Array.isArray(ui.equip) ? ui.equip.map(String) : [];
    const equipSelectedCount = equipSelected.length;
    const equipSelectedHtml = (!ui.equipOpen && equipSelectedCount)
      ? `<div class="rbEquipSelected" style="margin-top:10px;">${equipSelected.map(t=>`<button class="pill rbPill rbPillBtn" type="button" data-eq-remove="${escapeHtml(t)}" title="Filter entfernen">${escapeHtml(t)} <span aria-hidden="true">×</span></button>`).join("")}</div>`
      : "";
    const equipListHtml = ui.equipOpen
      ? `<div class="rbEquip" style="margin-top:10px;">${equipTags.map(tag => {
          const checked = equipSelected.includes(String(tag));
          return `<label class="rbCheck"><input type="checkbox" data-eq="${escapeHtml(tag)}" ${checked?"checked":""}/> ${escapeHtml(tag)}</label>`;
        }).join("")}</div>`
      : "";
    const filtered = filterRooms();
    const quickRoom = ui.quickRoomId ? roomById(ui.quickRoomId) : null;
    const quickFree = !!(quickRoom && rangeReady && isRoomFree(quickRoom.id, startIso, endIso));

    const myBookings = myUpcomingBookings(meId);

    const lastBid = String(ui.lastBookingId || "");

    root.innerHTML = `
      <div class="pageTitle">
        <div>
          <div class="pageTitle__eyebrow">GovConnect</div>
          <div class="pageTitle__title">Raumbuchung</div>
        </div>
        <div class="pageTitle__actions">
          <a class="btn" href="#/kalender">Kalender</a>
          <a class="btn" href="#/apps">Apps</a>
        </div>
      </div>

      <div class="grid grid--2">
        <div class="card">
          <div class="card__title">Schnell buchen</div>
          <div class="card__body">
            <div class="rbRow">
              <div class="rbField">
                <label class="label" for="rb-quick-room">Raum</label>
                <select id="rb-quick-room">
                  <option value="">– wählen –</option>
                  ${ROOMS.map(r => `<option value="${escapeHtml(r.id)}" ${String(r.id)===String(ui.quickRoomId)?"selected":""}>${escapeHtml(r.name)}</option>`).join("")}
                </select>
              </div>
              <div class="rbField">
                <label class="label" for="rb-date">Datum</label>
                <input id="rb-date" type="date" value="${escapeHtml(ui.date)}" />
              </div>
              <div class="rbField">
                <label class="label" for="rb-start">Start</label>
                <input id="rb-start" type="time" value="${escapeHtml(ui.start)}" />
              </div>
              <div class="rbField">
                <label class="label" for="rb-duration">Dauer</label>
                <select id="rb-duration">
                  ${[30,45,60,90,120,180,240].map(m => `<option value="${m}" ${Number(ui.duration)===m?"selected":""}>${m} min</option>`).join("")}
                </select>
              </div>
            </div>

            <div class="row" style="margin-top:12px; justify-content:space-between;">
              <div class="muted small">Zeitfenster: <strong>${rangeReady ? escapeHtml(fmtRange(startIso, endIso)) : "–"}</strong></div>
              <button class="btn btn--primary" type="button" id="rb-quick-book" ${(!quickFree) ? "disabled" : ""}>Buchen</button>
            </div>

            <div id="rb-quick-status" style="margin-top:10px;"></div>
          </div>
        </div>

        <div class="card">
          <div class="card__title">Meine Buchungen</div>
          <div class="card__body" id="rb-my"></div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="card__title">Räume finden</div>
        <div class="card__body">
          <div class="rbFilters">
            <div>
              <label class="label" for="rb-house">Haus</label>
              <select id="rb-house">
                <option value="all" ${ui.houseId==="all"?"selected":""}>Alle</option>
                ${HOUSES.map(h => `<option value="${escapeHtml(h.id)}" ${String(ui.houseId)===String(h.id)?"selected":""}>${escapeHtml(h.label)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="label" for="rb-mincap">Kapazität ≥</label>
              <input id="rb-mincap" type="number" min="0" placeholder="z.B. 12" value="${escapeHtml(String(ui.minCap||""))}" />
            </div>
            <div>
              <label class="label" for="rb-q">Suche</label>
              <input id="rb-q" type="search" placeholder="Name, Ausstattung, Lage …" value="${escapeHtml(ui.q||"")}" />
            </div>
          </div>

          <div class="rbEquipWrap" style="margin-top:10px;">
            <div class="rbEquipHead">
              <div class="muted small"><strong>Ausstattung</strong>${equipSelectedCount ? ` · ${equipSelectedCount} gewählt` : ""}</div>
              <button class="btn btn--sm" type="button" id="rb-equip-toggle">${ui.equipOpen ? "Filter ausblenden" : "Filter anzeigen"}</button>
            </div>
            ${equipSelectedHtml}
            ${equipListHtml}
          </div>

          <div class="muted small" style="margin-top:12px;">Frei/Belegt bezieht sich auf das oben gewählte Zeitfenster.</div>

          <div class="rbGrid" style="margin-top:12px;">
            ${filtered.map(r => {
              const free = rangeReady ? isRoomFree(r.id, startIso, endIso) : false;
              const conflict = (!free && rangeReady) ? firstConflict(r.id, startIso, endIso) : null;
              const who = (conflict && conflict.bookingId) ? bookedBy(conflict.bookingId) : null;
              const conflictLine = conflict ? `Belegt: ${fmtRange(conflict.start, conflict.end)}${who ? ` · ${who.name}` : ""}` : "";
              const pillCls = free ? "pill--ok" : "pill--warn";
              const pillTxt = rangeReady ? (free ? "Frei" : "Belegt") : "Zeit wählen";
              const seat = r.seating && r.seating.mode === "selectable" ? "Bestuhlung wählbar" : seatingLabel(r.seating?.default);
              const eq = (r.equipment||[]).slice(0,4).map(t => `<span class="pill rbPill">${escapeHtml(t)}</span>`).join("");
              return `
                <div class="rbRoom" data-room-id="${escapeHtml(r.id)}" role="button" tabindex="0" aria-label="Details zu ${escapeHtml(r.name)}">
                  <div class="rbRoom__img"><img src="${escapeHtml(roomImageUrl(r))}" alt="${escapeHtml(r.name)}" loading="lazy" /></div>
                  <div class="rbRoom__body">
                    <div class="row row--space" style="align-items:flex-start;">
                      <div>
                        <div class="rbRoom__title">${escapeHtml(r.name)}</div>
                        <div class="muted small">${escapeHtml(roomLocationLine(r))} · ${escapeHtml(String(r.capacity))} Pers.</div>
                        ${(!free && conflictLine) ? `<div class="muted small rbRoom__conflict">${escapeHtml(conflictLine)}</div>` : ""}
                      </div>
                      <span class="pill ${pillCls}">${pillTxt}</span>
                    </div>
                    <div class="rbRoom__eq">${eq}</div>
                    <div class="muted small" style="margin-top:10px;">${escapeHtml(r.type||"Raum")} · ${escapeHtml(seat)}</div>
                    <div class="row" style="justify-content:flex-end; gap:10px; margin-top:12px;">
                      <button class="btn" type="button" data-room-details="${escapeHtml(r.id)}">Details</button>
                      <button class="btn btn--primary" type="button" data-room-book="${escapeHtml(r.id)}" ${(!rangeReady || !free) ? "disabled" : ""}>Buchen</button>
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `;

    // --- Schnellbuchung Status ---
    const quickStatus = document.getElementById("rb-quick-status");
    if(quickStatus){
      if(lastBid){
        const lastMeeting = (state.gcBlocksDelta || []).find(b => b && b.kind === "meeting" && String(b.bookingId||"") === lastBid && b.meta && b.meta.source === "roomBooking" && String(b.ownerId||"") === String(meId||""));
        const lastRoom = lastMeeting ? roomById(lastMeeting.roomId) : null;
        const summary = lastMeeting ? `${lastRoom ? lastRoom.name : "Raum"} · ${fmtRange(lastMeeting.start, lastMeeting.end)}` : lastBid;
        quickStatus.innerHTML = `
          <div class="callout">
            <div class="callout__title">Buchung gespeichert</div>
            <div class="callout__text">${escapeHtml(summary)}</div>
            <div class="callout__actions">
              <button class="btn btn--primary btn--sm" type="button" id="rb-last-open">Kalender öffnen</button>
              <button class="btn btn--sm" type="button" id="rb-last-cancel">Storno</button>
            </div>
            <div class="muted small" style="margin-top:8px;">Tipp: Wenn du Datum/Start/Dauer oder den Raum änderst, kannst du direkt weiter buchen.</div>
          </div>
        `;

        const openBtn = document.getElementById("rb-last-open");
        if(openBtn){
          openBtn.addEventListener("click", () => {
            const iso = lastMeeting ? lastMeeting.start : "";
            goToCalendar(iso || startIso);
          });
        }
        const cancelBtn = document.getElementById("rb-last-cancel");
        if(cancelBtn){
          cancelBtn.addEventListener("click", () => {
            cancelBooking(lastBid);
            ui.lastBookingId = "";
            saveState();
            render();
          });
        }
      } else if(!quickRoom){
        quickStatus.innerHTML = `<div class="muted">Tipp: Wähle einen Raum und das Zeitfenster – dann kannst du direkt buchen.</div>`;
      } else if(!rangeReady){
        quickStatus.innerHTML = `<div class="muted">Zeitfenster wählen (Datum/Start/Dauer).</div>`;
      } else {
        const free = isRoomFree(quickRoom.id, startIso, endIso);
        if(free){
          quickStatus.innerHTML = `<div class="callout"><div class="callout__title">Verfügbar</div><div class="callout__text">${escapeHtml(quickRoom.name)} ist im Zeitfenster frei.</div></div>`;
        } else {
          const c = firstConflict(quickRoom.id, startIso, endIso);
          const who = (c && c.bookingId) ? bookedBy(c.bookingId) : null;
          const whoTxt = who ? ` · ${escapeHtml(who.name)}` : "";
          const whenTxt = c ? escapeHtml(fmtRange(c.start, c.end)) : "";
          quickStatus.innerHTML = `<div class="callout callout--warn"><div class="callout__title">Nicht verfügbar</div><div class="callout__text">Der Raum ist belegt${whenTxt ? ": " + whenTxt : ""}${whoTxt}.</div></div>`;
        }
      }
    }

    // --- Meine Buchungen ---
    const myEl = document.getElementById("rb-my");
    if(myEl){
      if(!myBookings.length){
        myEl.innerHTML = `<div class="muted">Keine kommenden Buchungen.</div>`;
      } else {
        myEl.innerHTML = `
          <div class="rbMy">
            ${myBookings.slice(0,8).map(b => {
              const rid = String(b.roomId || "");
              const r = roomById(rid);
              const name = r ? r.name : (b.meta?.roomName || rid || "Raum");
              const bid = String(b.bookingId || b.subject?.id || "");
              const range = fmtRange(b.start, b.end);
              const isNew = !!(lastBid && bid && bid === String(lastBid));
              const newPill = isNew ? `<span class="pill pill--accent rbMy__new">Neu</span>` : "";
              return `
                <div class="rbMy__item ${isNew ? "is-new" : ""}" role="button" tabindex="0" data-my-room="${escapeHtml(rid)}" data-my-start="${escapeHtml(b.start)}" data-my-end="${escapeHtml(b.end)}" data-my-bid="${escapeHtml(bid)}">
                  <div>
                    <div style="font-weight:900; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">${escapeHtml(name)} ${newPill}</div>
                    <div class="muted small">${escapeHtml(range)}</div>
                    <div class="muted small">${escapeHtml(b.title || "Termin")}</div>
                  </div>
                  <div class="rbMy__actions">
                    <button class="btn" type="button" data-my-cancel="${escapeHtml(bid)}">Storno</button>
                    <button class="btn" type="button" data-my-calendar="${escapeHtml(b.start)}">Kalender</button>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `;
      }
    }

    // --- Bind: quick form ---
    const elQuickRoom = document.getElementById("rb-quick-room");
    if(elQuickRoom){
      elQuickRoom.addEventListener("change", ()=>{
        ui.quickRoomId = elQuickRoom.value;
        ui.lastBookingId = "";
        saveState();
        render();
      });
    }

    const elDate = document.getElementById("rb-date");
    if(elDate){
      elDate.addEventListener("change", ()=>{
        ui.date = elDate.value;
        ui.lastBookingId = "";
        saveState();
        render();
      });
    }

    const elStart = document.getElementById("rb-start");
    if(elStart){
      elStart.addEventListener("change", ()=>{
        ui.start = elStart.value;
        ui.lastBookingId = "";
        saveState();
        render();
      });
    }

    const elDur = document.getElementById("rb-duration");
    if(elDur){
      elDur.addEventListener("change", ()=>{
        ui.duration = Number(elDur.value || 0);
        ui.lastBookingId = "";
        saveState();
        render();
      });
    }

    const btnQuick = document.getElementById("rb-quick-book");
    if(btnQuick){
      btnQuick.addEventListener("click", ()=>{
        if(!quickRoom || !rangeReady) return;
        if(!isRoomFree(quickRoom.id, startIso, endIso)) return;
        openBookingModal({ room: quickRoom, startIso, endIso, meId });
      });
    }

    // --- Bind: finder filters ---
    const elHouse = document.getElementById("rb-house");
    if(elHouse){
      elHouse.addEventListener("change", ()=>{
        ui.houseId = elHouse.value;
        saveState();
        render();
      });
    }

    const elMinCap = document.getElementById("rb-mincap");
    if(elMinCap){
      elMinCap.addEventListener("input", ()=>{
        ui.minCap = elMinCap.value;
        saveState();
        render();
      });
    }

    const elQ = document.getElementById("rb-q");
    if(elQ){
      elQ.addEventListener("input", ()=>{
        ui.q = elQ.value;
        saveState();
        render();
      });
    }

    root.querySelectorAll("input[type='checkbox'][data-eq]").forEach(cb => {
      cb.addEventListener("change", ()=>{
        const tag = cb.getAttribute("data-eq");
        if(!tag) return;
        const cur = Array.isArray(ui.equip) ? ui.equip.map(String) : [];
        const next = cb.checked
          ? uniqStrings(cur.concat([tag]))
          : cur.filter(x => String(x) !== String(tag));
        ui.equip = next;
        saveState();
        render();
      });
    });

    const btnEquipToggle = document.getElementById("rb-equip-toggle");
    if(btnEquipToggle){
      btnEquipToggle.addEventListener("click", ()=>{
        ui.equipOpen = !ui.equipOpen;
        saveState();
        render();
      });
    }

    root.querySelectorAll("[data-eq-remove]").forEach(btn => {
      btn.addEventListener("click", (e)=>{
        e.stopPropagation();
        const tag = btn.getAttribute("data-eq-remove");
        if(!tag) return;
        const cur = Array.isArray(ui.equip) ? ui.equip.map(String) : [];
        ui.equip = cur.filter(x => String(x) !== String(tag));
        saveState();
        render();
      });
    });

    // --- Bind: room actions ---
    root.querySelectorAll("[data-room-book]").forEach(btn => {
      btn.addEventListener("click", (e)=>{
        e.stopPropagation();
        const rid = btn.getAttribute("data-room-book");
        if(!rid || !rangeReady) return;
        const r = roomById(rid);
        if(!r) return;
        if(!isRoomFree(r.id, startIso, endIso)) return;
        openBookingModal({ room: r, startIso, endIso, meId });
      });
    });

    root.querySelectorAll("[data-room-details]").forEach(btn => {
      btn.addEventListener("click", (e)=>{
        e.stopPropagation();
        const rid = btn.getAttribute("data-room-details");
        const r = rid ? roomById(rid) : null;
        if(!r) return;
        openRoomDetailsModal({ room: r, startIso, endIso, meId });
      });
    });

    // Click anywhere on a room card to open details (except on buttons/inputs)
    root.querySelectorAll(".rbRoom[data-room-id]").forEach(card => {
      const rid = card.getAttribute("data-room-id");
      card.addEventListener("click", (e)=>{
        if(e.target.closest("button,a,input,select,textarea,label")) return;
        const r = rid ? roomById(rid) : null;
        if(!r) return;
        openRoomDetailsModal({ room: r, startIso, endIso, meId });
      });
      card.addEventListener("keydown", (e)=>{
        if(e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        const r = rid ? roomById(rid) : null;
        if(!r) return;
        openRoomDetailsModal({ room: r, startIso, endIso, meId });
      });
    });

    // --- Bind: cancel booking ---
    root.querySelectorAll("[data-my-cancel]").forEach(btn => {
      btn.addEventListener("click", (e)=>{
        e.stopPropagation();
        const bid = btn.getAttribute("data-my-cancel");
        if(!bid) return;
        cancelBooking(bid, meId);
        if(String(ui.lastBookingId || "") === String(bid)) ui.lastBookingId = "";
        saveState();
        render();
      });
    });

    root.querySelectorAll("[data-my-calendar]").forEach(btn => {
      btn.addEventListener("click", (e)=>{
        e.stopPropagation();
        const iso = btn.getAttribute("data-my-calendar") || "";
        goToCalendar(iso);
      });
    });

    root.querySelectorAll(".rbMy__item[data-my-room]").forEach(item => {
      item.addEventListener("click", (e)=>{
        if(e.target.closest("button,a")) return;
        const rid = item.getAttribute("data-my-room") || "";
        const s = item.getAttribute("data-my-start") || "";
        const en = item.getAttribute("data-my-end") || "";
        const r = rid ? roomById(rid) : null;
        if(!r) return;
        openRoomDetailsModal({ room: r, startIso: s, endIso: en, meId });
      });
      item.addEventListener("keydown", (e)=>{
        if(e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        const rid = item.getAttribute("data-my-room") || "";
        const s = item.getAttribute("data-my-start") || "";
        const en = item.getAttribute("data-my-end") || "";
        const r = rid ? roomById(rid) : null;
        if(!r) return;
        openRoomDetailsModal({ room: r, startIso: s, endIso: en, meId });
      });
    });
  }

  render();
}
