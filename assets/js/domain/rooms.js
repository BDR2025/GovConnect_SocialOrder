/* social_order_v0.20.4.0 · domain/rooms (ESM)
   Raumbuchung (Demo): Häuser, Räume, Ausstattung und einfache Verfügbarkeitslogik.

   Persistenz der Buchungen erfolgt über core/eventhub (gcBlocksDelta).
   - Raum-Sperren: ownerId = "room:<roomId>", kind = "room"
   - Persönliche Kalenderkopie: ownerId = <personId>, kind = "meeting"

   Für die Demo ist der Ablauf bewusst binär:
   - frei → Buchung möglich
   - belegt → Buchung nicht möglich

   Konflikt-/Sperrprüfung basiert ausschließlich auf den Raum-Sperrblöcken.
*/

export const HOUSES = [
  { id: "H1", label: "Haus 1", note: "Rathaus · Hauptgebäude" },
  { id: "H2", label: "Haus 2", note: "Verwaltungszentrum" },
  { id: "H3", label: "Haus 3", note: "Bürgerdienste" }
];

export const ROOMS = [
  {
    id: "R-H3-S01",
    houseId: "H3",
    locationLine: "2. OG, Westflügel",
    displayName: "Saal Sophia Kallmair",
    capacity: 60,
    type: "Saal",
    seating: {
      mode: "selectable",
      default: "Parlament",
      options: ["Parlament", "U-Form", "Reihen", "Stehempfang"]
    },
    equipmentTags: ["Beamer", "Leinwand", "Teams-System", "2 Funkmikrofone", "Whiteboard"],
    history:
      "Benannt nach Sophia Kallmair (Bürgermeisterin 1921–1933). Sie steht für die frühe Modernisierung der Verwaltung und die ersten zentralen Bürgerdienste.",
    image: "assets/img/rooms/room_r-h3-s01_sophia-kallmair.png"
  },
  {
    id: "R-H1-K01",
    houseId: "H1",
    locationLine: "1. OG, Nordflügel",
    displayName: "Konferenzraum Ludwig",
    capacity: 16,
    type: "Konferenzraum",
    seating: { mode: "fixed", default: "Tischblock", options: [] },
    equipmentTags: ["Display 75\"", "Teams-Bar", "Whiteboard", "HDMI"],
    history:
      "Benannt nach Ludwig Faber, dem ersten Stadtkämmerer nach der Verwaltungsreform. Er prägte die Standardisierung von Beschaffung und Haushaltssteuerung und gilt als Vater des modernen Controllings.",
    image: "assets/img/rooms/room_r-h1-k01_ludwig.png"
  },
  {
    id: "R-H3-K02",
    houseId: "H3",
    locationLine: "EG, Ostflügel",
    displayName: "Konferenzraum Gemeinde Köllerbach",
    capacity: 12,
    type: "Konferenzraum",
    seating: { mode: "fixed", default: "Tischblock", options: [] },
    equipmentTags: ["Beamer (mobil)", "Whiteboard", "Konferenzlautsprecher"],
    history:
      "Die Gemeinde Köllerbach war eine der ersten, die Verwaltungsprozesse in einem interkommunalen Pilotverbund geöffnet hat. Der Raum erinnert daran, dass pragmatische Innovation oft aus Ortsteilen und kleinen Teams kommt.",
    image: "assets/img/rooms/room_r-h3-k02_koellerbach.png"
  },
  {
    id: "R-H2-SCH01",
    houseId: "H2",
    locationLine: "3. OG, Südflügel",
    displayName: "Schulungsraum Digitalwerkstatt",
    capacity: 28,
    type: "Schulungsraum",
    seating: {
      mode: "selectable",
      default: "Classroom",
      options: ["Classroom", "U-Form", "Inseln"]
    },
    equipmentTags: ["Beamer", "Trainer-PC", "Dokumentenkamera", "Whiteboard"],
    history:
      "Die Digitalwerkstatt wurde als Lernraum gegründet, nachdem mehrere Projekte an fehlender Anwenderpraxis scheiterten. Heute ist sie fester Ort für Onboarding, Praxisformate und Tool-Schulungen.",
    image: "assets/img/rooms/room_r-h2-sch01_digitalwerkstatt.png"
  },
  {
    id: "R-H2-PC01",
    houseId: "H2",
    locationLine: "2. OG, Ostflügel",
    displayName: "PC-Arbeitsraum Datenbüro",
    capacity: 10,
    type: "PC-Arbeitsraum",
    seating: { mode: "fixed", default: "PC-Plätze", options: [] },
    equipmentTags: ["10 PC-Arbeitsplätze", "2 Monitore", "Scanner", "Drucker", "Whiteboard"],
    history:
      "Das Datenbüro entstand als Ausweichfläche für Statistik und Berichtswesen in Hochphasen der Haushaltsplanung. Heute nutzen Teams den Raum für Auswertungen, Serienläufe und konzentrierte Arbeit mit fester Technik.",
    image: "assets/img/rooms/room_r-h2-pc01_datenbuero.png"
  },
  {
    id: "R-H1-PROJ01",
    houseId: "H1",
    locationLine: "EG, Westflügel",
    displayName: "Projektstudio Rathauslabor",
    capacity: 8,
    type: "Projektstudio",
    seating: { mode: "fixed", default: "Workshop", options: [] },
    equipmentTags: ["Display 55\"", "Whiteboard-Wand", "Pinwand", "Moderationskoffer", "Video-Set"],
    history:
      "Das Rathauslabor ist der Arbeitsraum für bereichsübergreifende Projektteams: schnell entscheiden, sichtbar arbeiten, Ergebnisse direkt dokumentieren. Funktional statt repräsentativ – mit viel Fläche für Visualisierung.",
    image: "assets/img/rooms/room_r-h1-proj01_rathauslabor.png"
  }
];

export function houseById(id){
  const key = String(id || "");
  return HOUSES.find(h => h && String(h.id) === key) || null;
}

export function roomById(id){
  const key = String(id || "");
  return ROOMS.find(r => r && String(r.id) === key) || null;
}

export function roomLocationText(room){
  const r = room || null;
  if(!r) return "";
  const h = houseById(r.houseId);
  const houseLabel = h ? h.label : (r.houseId ? String(r.houseId) : "Haus");
  return `${houseLabel} · ${r.locationLine || ""}`.trim();
}

export function uniqueIds(arr){
  const out = [];
  const seen = new Set();
  (Array.isArray(arr) ? arr : []).forEach(x => {
    const k = String(x || "").trim();
    if(!k) return;
    if(seen.has(k)) return;
    seen.add(k);
    out.push(k);
  });
  return out;
}

export function makeBookingId(){
  return `rb_${Math.random().toString(36).slice(2,10)}_${Date.now().toString(36)}`;
}

function intersects(startA, endA, startB, endB){
  const a0 = new Date(startA).getTime();
  const a1 = new Date(endA).getTime();
  const b0 = new Date(startB).getTime();
  const b1 = new Date(endB).getTime();
  if(Number.isNaN(a0) || Number.isNaN(a1) || Number.isNaN(b0) || Number.isNaN(b1)) return false;
  return a0 < b1 && b0 < a1;
}

export function listRoomBlocks(state, roomId){
  const sid = String(roomId || "");
  const blocks = (state && Array.isArray(state.gcBlocksDelta)) ? state.gcBlocksDelta : [];
  return blocks
    .filter(b => b && b.kind === "room")
    .filter(b => {
      // primary: ownerId = room:<id>
      if(b.ownerId && String(b.ownerId) === `room:${sid}`) return true;
      // fallback: meta.roomId
      const mid = b.meta && b.meta.roomId ? String(b.meta.roomId) : "";
      return mid && mid === sid;
    });
}

export function roomConflicts(state, roomId, startIso, endIso){
  return listRoomBlocks(state, roomId).filter(b => intersects(b.start, b.end, startIso, endIso));
}

export function isRoomAvailable(state, roomId, startIso, endIso){
  return roomConflicts(state, roomId, startIso, endIso).length === 0;
}

export function buildRoomBookingBlocks({
  roomId,
  startIso,
  endIso,
  organizerId,
  inviteeIds = [],
  title = "",
  seating = "",
  bookingId = null
} = {}){
  const room = roomById(roomId);
  if(!room) throw new Error("room booking: room not found");

  const bid = bookingId || makeBookingId();
  const loc = roomLocationText(room);

  const meetingTitle = String(title || "").trim() ? String(title).trim() : room.displayName;
  const meetingMeta = String(title || "").trim()
    ? `${room.displayName} · ${loc}`
    : loc;

  const parts = uniqueIds([organizerId].concat(inviteeIds));

  const roomBlock = {
    ownerId: `room:${room.id}`,
    kind: "room",
    start: startIso,
    end: endIso,
    title: room.displayName,
    meta: loc,
    visibility: { mode: "owner" },
    booking: { kind: "room", id: bid },
    meta2: { roomId: room.id, bookingId: bid, organizerId: String(organizerId||""), seating: seating || "", inviteeIds: parts.filter(x=>x!==String(organizerId||"")) }
  };

  const meetingBlocks = parts.map(pid => ({
    ownerId: pid,
    kind: "meeting",
    start: startIso,
    end: endIso,
    title: meetingTitle,
    meta: meetingMeta,
    visibility: { mode: "ownerAndLeads" },
    booking: { kind: "room", id: bid },
    meta2: { roomId: room.id, bookingId: bid, organizerId: String(organizerId||""), seating: seating || "", participants: parts }
  }));

  return { bookingId: bid, room, roomBlock, meetingBlocks };
}
