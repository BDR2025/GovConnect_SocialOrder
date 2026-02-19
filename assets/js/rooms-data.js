/* GovConnect · Raumbuchung (Demo) – Stammdaten
   - bewusst klein gehalten (6 Räume)
   - Bilder liegen unter assets/img/rooms/

   Hinweis: Diese Datei ist absichtlich "dumm" (nur Daten).
*/

export const HOUSES = [
  {
    "id": "H1",
    "label": "Haus 1",
    "name": "Rathaus (Haus 1)",
    "short": "Haus 1"
  },
  {
    "id": "H2",
    "label": "Haus 2",
    "name": "Verwaltungsgebäude (Haus 2)",
    "short": "Haus 2"
  },
  {
    "id": "H3",
    "label": "Haus 3",
    "name": "Altbau (Haus 3)",
    "short": "Haus 3"
  }
];

export const ROOMS = [
  {
    "id": "R-H3-S01",
    "houseId": "H3",
    "locationLine": "2. OG · Westflügel",
    "displayName": "Saal Sophia Kallmair",
    "shortName": "Kallmair",
    "capacity": 60,
    "type": "Saal",
    "seating": {
      "mode": "selectable",
      "default": "Parlament",
      "options": [
        "Parlament",
        "U-Form",
        "Reihen",
        "Stehempfang"
      ]
    },
    "equipmentTags": [
      "Beamer",
      "Leinwand",
      "Teams-System",
      "2 Funkmikrofone",
      "Whiteboard"
    ],
    "history": "Benannt nach Sophia Kallmair, Bürgermeisterin von 1921 bis 1933. Sie gilt als frühe Modernisiererin der Verwaltung und Initiatorin der ersten zentralen Bürgerdienste.",
    "image": "assets/img/rooms/room_r-h3-s01_sophia-kallmair.png"
  },
  {
    "id": "R-H1-K01",
    "houseId": "H1",
    "locationLine": "1. OG · Nordflügel",
    "displayName": "Konferenzraum Ludwig",
    "shortName": "Ludwig",
    "capacity": 16,
    "type": "Konferenzraum",
    "seating": {
      "mode": "fixed",
      "default": "Tischblock",
      "options": [
        "Tischblock"
      ]
    },
    "equipmentTags": [
      "75\" Display",
      "Teams-Bar",
      "Whiteboard",
      "HDMI"
    ],
    "history": "Benannt nach Ludwig Faber, dem ersten Stadtkämmerer der Kreisstadt Exempla nach der Verwaltungsreform. Er prägte die frühe Standardisierung von Beschaffung und Haushaltssteuerung und gilt intern als Vater des modernen Controllings.",
    "image": "assets/img/rooms/room_r-h1-k01_ludwig.png"
  },
  {
    "id": "R-H3-K02",
    "houseId": "H3",
    "locationLine": "EG · Ostflügel",
    "displayName": "Konferenzraum Gemeinde Köllerbach",
    "shortName": "Köllerbach",
    "capacity": 12,
    "type": "Konferenzraum",
    "seating": {
      "mode": "fixed",
      "default": "Tischblock",
      "options": [
        "Tischblock"
      ]
    },
    "equipmentTags": [
      "Beamer mobil",
      "Whiteboard",
      "Konferenzlautsprecher"
    ],
    "history": "Die Gemeinde Köllerbach war eine der ersten, die ihre Verwaltungsprozesse in einem interkommunalen Pilotverbund geöffnet hat. Sie steht in Exempla als Symbol dafür, dass Modernisierung nicht nur aus dem Rathaus kommt, sondern oft aus pragmatischen Lösungen in den Ortsteilen.",
    "image": "assets/img/rooms/room_r-h3-k02_koellerbach.png"
  },
  {
    "id": "R-H2-SCH01",
    "houseId": "H2",
    "locationLine": "3. OG · Südflügel",
    "displayName": "Schulungsraum Digitalwerkstatt",
    "shortName": "Digitalwerkstatt",
    "capacity": 28,
    "type": "Schulungsraum",
    "seating": {
      "mode": "selectable",
      "default": "Classroom",
      "options": [
        "Classroom",
        "U-Form",
        "Inseln"
      ]
    },
    "equipmentTags": [
      "Beamer",
      "Whiteboard",
      "Trainer-PC",
      "Dokumentenkamera"
    ],
    "history": "Die Digitalwerkstatt wurde als interner Lernraum gegründet, nachdem mehrere Großprojekte an fehlender Anwenderkompetenz gescheitert waren. Heute ist sie der feste Ort für kurze Praxisformate, Onboarding und Tool-Schulungen.",
    "image": "assets/img/crest_240.png"
  },
  {
    "id": "R-H2-PC01",
    "houseId": "H2",
    "locationLine": "2. OG · Ostflügel",
    "displayName": "PC-Arbeitsraum Datenbüro",
    "shortName": "Datenbüro",
    "capacity": 10,
    "type": "PC-Arbeitsraum",
    "seating": {
      "mode": "fixed",
      "default": "PC-Plätze",
      "options": [
        "PC-Plätze"
      ]
    },
    "equipmentTags": [
      "10 PC-Arbeitsplätze",
      "2 Monitore",
      "Scanner",
      "Drucker",
      "Whiteboard"
    ],
    "history": "Das Datenbüro entstand ursprünglich als Ausweichfläche für Statistik und Berichtswesen in Hochphasen der Haushaltsplanung. Heute wird es für Auswertungen, Seriendokumente und konzentrierte Arbeit genutzt, wenn Teams einen ruhigen Raum mit fester Technik brauchen.",
    "image": "assets/img/crest_240.png"
  },
  {
    "id": "R-H1-PROJ01",
    "houseId": "H1",
    "locationLine": "EG · Westflügel",
    "displayName": "Projektstudio Rathauslabor",
    "shortName": "Rathauslabor",
    "capacity": 8,
    "type": "Projektstudio",
    "seating": {
      "mode": "fixed",
      "default": "Workshop",
      "options": [
        "Workshop"
      ]
    },
    "equipmentTags": [
      "55\" Display",
      "Whiteboard-Wand",
      "Pinwand",
      "Moderationskoffer",
      "Videokonferenz-Set"
    ],
    "history": "Das Rathauslabor wurde als Raum für bereichsübergreifende Projektteams eingerichtet, damit Entscheidungen sichtbar, schnell und dokumentierbar entstehen. Der Raum ist bewusst nicht repräsentativ, sondern funktional, mit viel Fläche für Visualisierung und Arbeitsstände.",
    "image": "assets/img/crest_240.png"
  }
];
