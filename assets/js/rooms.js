/* social_order_v0.20.3.5 · rooms (ESM)
   Stammdaten für die Demo-App „Raumbuchung“.

   Konzept:
   - Kleine, aber glaubwürdige Raumlandschaft.
   - Räume sind für alle buchbar ("frei ist frei").
   - Bestuhlung ist meist fix, nur bei zwei großen Räumen wählbar.
   - Bilder liegen unter assets/img/rooms/.
*/

export const HOUSES = [
  {
    id: "H1",
    label: "Haus 1",
    short: "Rathaus · Hauptgebäude"
  },
  {
    id: "H2",
    label: "Haus 2",
    short: "Verwaltungszentrum"
  },
  {
    id: "H3",
    label: "Haus 3",
    short: "Bürgerdienste"
  },
  {
    id: "HE",
    label: "Haus E",
    short: "Feuerwehrverwaltung"
  }
];

export const SEATING_OPTIONS = [
  { key: "parlament", label: "Parlament" },
  { key: "uform", label: "U‑Form" },
  { key: "reihen", label: "Reihen" },
  { key: "inseln", label: "Inseln" },
  { key: "stehempfang", label: "Stehempfang" },
  { key: "classroom", label: "Classroom" },
  { key: "tischblock", label: "Tischblock" },
  { key: "ovaltisch", label: "Ovaltisch" },
  { key: "pc", label: "PC‑Plätze" },
  { key: "workshop", label: "Workshop" }
];

export const ROOMS = [
  {
    id: "R-H3-S01",
    houseId: "H3",
    locationLine: "2. OG · Westflügel",
    name: "Saal Sophia Kallmair",
    capacity: 60,
    type: "Saal",
    seating: {
      mode: "selectable",
      default: "parlament",
      options: ["parlament", "uform", "reihen", "stehempfang"]
    },
    equipment: ["Beamer", "Leinwand", "Teams‑System", "2 Funkmikrofone", "Whiteboard"],
    info: "Benannt nach Sophia Kallmair, Bürgermeisterin von 1921 bis 1933. Sie gilt als frühe Modernisiererin der Verwaltung und Initiatorin der ersten zentralen Bürgerdienste.",
    image: "room_r-h3-s01_sophia-kallmair.png"
  },
  {
    id: "R-H1-K01",
    houseId: "H1",
    locationLine: "1. OG · Nordflügel",
    name: "Konferenzraum Ludwig",
    capacity: 16,
    type: "Konferenzraum",
    seating: { mode: "fixed", default: "tischblock", options: [] },
    equipment: ["75\" Display", "Teams‑Bar", "Whiteboard", "HDMI"],
    info: "Erinnert an Ludwig Faber, den ersten Stadtkämmerer der Kreisstadt Exempla nach der Verwaltungsreform. Er prägte die frühe Standardisierung von Beschaffung und Haushaltssteuerung und gilt intern als Vater des modernen Controllings.",
    image: "room_r-h1-k01_ludwig.png"
  },
  {
    id: "R-H3-K02",
    houseId: "H3",
    locationLine: "EG · Ostflügel",
    name: "Konferenzraum Gemeinde Köllerbach",
    capacity: 12,
    type: "Konferenzraum",
    seating: { mode: "fixed", default: "tischblock", options: [] },
    equipment: ["Beamer (mobil)", "Whiteboard", "Konferenzlautsprecher"],
    info: "Die Gemeinde Köllerbach war eine der ersten, die Verwaltungsprozesse in einem interkommunalen Pilotverbund geöffnet hat. Sie steht in Exempla als Symbol dafür, dass Modernisierung nicht nur aus dem Rathaus kommt, sondern oft aus pragmatischen Lösungen in den Ortsteilen.",
    image: "room_r-h3-k02_koellerbach.png"
  },
  {
    id: "R-H2-SCH01",
    houseId: "H2",
    locationLine: "3. OG · Südflügel",
    name: "Schulungsraum Digitalwerkstatt",
    capacity: 28,
    type: "Schulungsraum",
    seating: {
      mode: "selectable",
      default: "classroom",
      options: ["classroom", "uform", "inseln"]
    },
    equipment: ["Beamer", "Whiteboard", "Trainer‑PC", "Dokumentenkamera"],
    info: "Die Digitalwerkstatt wurde als interner Lernraum gegründet, nachdem mehrere Vorhaben an fehlender Anwenderkompetenz scheiterten. Heute ist sie der feste Ort für praxisnahe Schulungen, Onboarding und Tool‑Formate.",
    image: "room_r-h2-sch01_digitalwerkstatt.png"
  },
  {
    id: "R-H2-PC01",
    houseId: "H2",
    locationLine: "2. OG · Ostflügel",
    name: "PC‑Arbeitsraum Datenbüro",
    capacity: 10,
    type: "PC‑Arbeitsraum",
    seating: { mode: "fixed", default: "pc", options: [] },
    equipment: ["10 PC‑Arbeitsplätze", "2 Monitore je Platz", "Scanner", "Drucker", "Whiteboard"],
    info: "Das Datenbüro entstand ursprünglich als Ausweichfläche für Statistik und Berichtswesen in Hochphasen der Haushaltsplanung. Heute wird es für Auswertungen, Seriendokumente und konzentrierte Arbeit genutzt.",
    image: "room_r-h2-pc01_datenbuero.png"
  },
  {
    id: "R-H1-PROJ01",
    houseId: "H1",
    locationLine: "EG · Westflügel",
    name: "Projektstudio Rathauslabor",
    capacity: 8,
    type: "Projektraum",
    seating: { mode: "fixed", default: "workshop", options: [] },
    equipment: ["55\" Display", "Whiteboard‑Wand", "Pinwand", "Moderationskoffer", "Videokonferenz‑Set"],
    info: "Das Rathauslabor wurde als Raum für bereichsübergreifende Projektteams eingerichtet, damit Entscheidungen sichtbar, schnell und dokumentierbar entstehen. Der Raum ist bewusst funktional, mit viel Fläche für Visualisierung und Arbeitsstände.",
    image: "room_r-h1-proj01_rathauslabor.png"
  },
  {
    id: "R-H1-HIST01",
    houseId: "H1",
    locationLine: "1. OG · Historischer Flügel",
    name: "Historischer Sitzungssaal Wilhelm Ahrens",
    capacity: 24,
    type: "Historischer Sitzungssaal",
    seating: { mode: "fixed", default: "ovaltisch", options: [] },
    equipment: ["Deckenmikrofone", "65\" Display", "Teams‑System", "Dokumentenkamera", "Whiteboard", "HDMI", "WLAN‑Gastzugang"],
    info: "Benannt nach Wilhelm Ahrens, dem ersten Bürgermeister der Kreisstadt Exempla. Unter seiner Amtszeit wurden die ersten festen Sitzungsordnungen eingeführt und die Verwaltung vom Ehrenamt schrittweise in eine professionelle Stadtorganisation überführt. Der Sitzungssaal liegt im historischen Flügel und wurde behutsam modernisiert, damit traditionelle Architektur und zeitgemäße Gremienarbeit zusammenpassen.",
    image: "room_r-h1-hist01_wilhelm-ahrens.png"
  },
  {
    id: "R-HE-B01",
    houseId: "HE",
    locationLine: "EG · Feuerwehrverwaltung · Nordtrakt",
    name: "Besprechungsraum St. Florian",
    capacity: 14,
    type: "Besprechungsraum Einsatz",
    seating: { mode: "fixed", default: "tischblock", options: [] },
    equipment: ["86\" Lagebildschirm", "Teams‑System", "Konferenzlautsprecher", "Whiteboard", "Magnet Lagekarte", "HDMI", "WLAN", "Ladeleiste Funkgeräte", "Drucker"],
    info: "Benannt nach dem Heiligen Florian, dem Schutzpatron der Feuerwehr. Der Raum wird für Einsatznachbereitung, Lagebesprechungen und Abstimmungen zwischen Wehrführung und Verwaltung genutzt. Er steht exemplarisch für die operative Seite der Stadt, in der Entscheidungen unter Zeitdruck getroffen und sauber dokumentiert werden müssen.",
    image: "room_r-he-b01_st-florian.png"
  }
];
