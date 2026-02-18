/* social_order_v0.19.3 · Mock-Daten (keine externen Abhängigkeiten)
   Hinweis: Version steht zusätzlich in MOCK.meta.version */

import { DEMO_SUPPLIERS, DEMO_CATALOG } from "./domain/contracts/index.js";

export const MOCK = {
  "meta": {
    "version": "0.19.3",
    "currency": "EUR",
    "cutoffLabel": "Di 11:00",
    "gateThreshold": 25
  },

  // ------------------------------------------------------------
  // Exempla: Organisationsstruktur (für Demo / Stammdaten)
  // - Im Livebetrieb käme die Organisationseinheit aus dem Current User.
  // - In der Demo wird sie bewusst per Dropdown gewählt.
  // ------------------------------------------------------------
  "orgModel": {
    "orgName": "Kreisstadt Exempla",
    "population": "80.000",
    "departments": [
      {
        "id": "FB1",
        "name": "Zentrale Steuerung",
        "units": [
          {
            "id": "A11",
            "label": "Amt 11",
            "name": "Finanzen und Controlling",
            "costCenters": [
              { "code": "1101", "name": "Haushaltsplanung und Controlling" },
              { "code": "1102", "name": "Kasse und Zahlungsverkehr" },
              { "code": "1103", "name": "Steuern und Abgaben" }
            ],
            "locations": [
              "Rathaus (Haus A) · Raum 2.14",
              "Rathaus (Haus A) · Raum 1.08",
              "Rathaus (Haus A) · Raum 0.11"
            ]
          },
          {
            "id": "A12",
            "label": "Amt 12",
            "name": "Personal und Organisation",
            "costCenters": [
              { "code": "1201", "name": "Personalverwaltung" },
              { "code": "1202", "name": "Personalentwicklung und Fortbildung" },
              { "code": "1203", "name": "Organisation und Digitalisierung" }
            ],
            "locations": [
              "Rathaus (Haus A) · Raum 3.02",
              "Rathaus (Haus A) · Raum 3.03"
            ]
          },
          {
            "id": "A13",
            "label": "Amt 13",
            "name": "Recht, Gremien und Kommunikation",
            "costCenters": [
              { "code": "1301", "name": "Rechtsangelegenheiten" },
              { "code": "1302", "name": "Gremienbüro" },
              { "code": "1303", "name": "Öffentlichkeitsarbeit" }
            ],
            "locations": [
              "Rathaus (Haus A) · Raum 2.05",
              "Rathaus (Haus A) · Raum 2.06"
            ]
          }
        ]
      },
      {
        "id": "FB2",
        "name": "Bürgerservice und Ordnung",
        "units": [
          {
            "id": "A21",
            "label": "Amt 21",
            "name": "Bürgerbüro und Standesamt",
            "costCenters": [
              { "code": "2101", "name": "Bürgerbüro" },
              { "code": "2102", "name": "Standesamt" },
              { "code": "2103", "name": "Wahlen und Meldewesen" }
            ],
            "locations": [
              "Bürgerbüro (Haus B) · Frontoffice",
              "Standesamt (Haus B) · Raum 0.12",
              "Bürgerbüro (Haus B) · Backoffice"
            ]
          },
          {
            "id": "A22",
            "label": "Amt 22",
            "name": "Ordnungsamt und Gewerbe",
            "costCenters": [
              { "code": "2201", "name": "Gewerbeangelegenheiten" },
              { "code": "2202", "name": "Ordnungsdienst" },
              { "code": "2203", "name": "Verkehrsüberwachung" }
            ],
            "locations": [
              "Ordnungsamt (Haus B) · Raum 1.07",
              "Ordnungsamt (Haus B) · Raum 1.11"
            ]
          },
          {
            "id": "A23",
            "label": "Amt 23",
            "name": "Feuerwehr und Bevölkerungsschutz",
            "costCenters": [
              { "code": "2301", "name": "Feuerwehr" },
              { "code": "2302", "name": "Katastrophenschutz" },
              { "code": "2303", "name": "Brandschutzprävention" }
            ],
            "locations": [
              "Feuerwehr (Haus E) · Verwaltung",
              "Feuerwehr (Haus E) · Gerätehaus"
            ]
          }
        ]
      },
      {
        "id": "FB3",
        "name": "Stadtentwicklung und Infrastruktur",
        "units": [
          {
            "id": "A31",
            "label": "Amt 31",
            "name": "Stadtplanung und Bauordnung",
            "costCenters": [
              { "code": "3101", "name": "Stadtplanung" },
              { "code": "3102", "name": "Bauordnung" },
              { "code": "3103", "name": "Denkmalschutz" }
            ],
            "locations": [
              "Bauamt (Haus C) · Raum 1.16",
              "Bauamt (Haus C) · Raum 0.09"
            ]
          },
          {
            "id": "A32",
            "label": "Amt 32",
            "name": "Tiefbau und Verkehr",
            "costCenters": [
              { "code": "3201", "name": "Straßenbau und Unterhaltung" },
              { "code": "3202", "name": "Verkehr und Mobilität" },
              { "code": "3203", "name": "Straßenbeleuchtung" }
            ],
            "locations": [
              "Bauhof (Haus D) · Lager 0.03",
              "Bauhof (Haus D) · Büro 1.02"
            ]
          },
          {
            "id": "A33",
            "label": "Amt 33",
            "name": "Gebäudemanagement und Liegenschaften",
            "costCenters": [
              { "code": "3301", "name": "Gebäudemanagement" },
              { "code": "3302", "name": "Liegenschaften" },
              { "code": "3303", "name": "Hausmeisterdienste" }
            ],
            "locations": [
              "Rathaus (Haus A) · Raum 0.15",
              "Hausmeisterpool · Zentrale"
            ]
          }
        ]
      },
      {
        "id": "FB4",
        "name": "Soziales, Bildung und Kultur",
        "units": [
          {
            "id": "A41",
            "label": "Amt 41",
            "name": "Soziales und Integration",
            "costCenters": [
              { "code": "4101", "name": "Sozialhilfe" },
              { "code": "4102", "name": "Integration" },
              { "code": "4103", "name": "Wohngeld" }
            ],
            "locations": [
              "Sozialamt (Haus A) · Raum 2.14",
              "Sozialamt (Haus A) · Raum 2.18"
            ]
          },
          {
            "id": "A42",
            "label": "Amt 42",
            "name": "Jugend und Familie",
            "costCenters": [
              { "code": "4201", "name": "Jugendhilfe" },
              { "code": "4202", "name": "Kita und Tagespflege" },
              { "code": "4203", "name": "Familienberatung" }
            ],
            "locations": [
              "Jugendamt (Haus A) · Raum 1.05",
              "Kita Sonnenschein · Leitung"
            ]
          },
          {
            "id": "A43",
            "label": "Amt 43",
            "name": "Schulen, Kultur und Sport",
            "costCenters": [
              { "code": "4301", "name": "Schulen" },
              { "code": "4302", "name": "Kultur" },
              { "code": "4303", "name": "Sportförderung" }
            ],
            "locations": [
              "Schulverwaltung (Haus F) · Raum 2.09",
              "Sporthalle Nord · Hausmeister"
            ]
          }
        ]
      }
    ]
  },
  "suppliers": DEMO_SUPPLIERS,
  "catalog": DEMO_CATALOG,
  "orders": [
    {
      "id": "SO-1042",
      "createdAt": "2026-02-10T09:30:00Z",
      "org": "Amt 21",
      "costCenter": "2101",
      "location": "Bürgerbüro (Haus B) · Frontoffice",
      "purpose": "Öffentlicher Kopierer im Bürgerbüro – Verbrauchsmaterial.",
      "urgency": "normal",
      "status": "Freigegeben",
      "items": [
        {
          "id": "A-023",
          "title": "Kopierpapier A4 (500 Blatt)",
          "unit": "Paket",
          "qty": 2,
          "price": 4.79,
          "vendor": "PrintLine AG",
          "contract": "Rahmenvertrag 2"
        },
        {
          "id": "A-001",
          "title": "Kugelschreiber blau",
          "unit": "Stück",
          "qty": 10,
          "price": 0.49,
          "vendor": "OfficePro GmbH",
          "contract": "Rahmenvertrag 1"
        },
        {
          "id": "A-038",
          "title": "Whiteboard-Stifte (4er Set)",
          "unit": "Set",
          "qty": 1,
          "price": 4.99,
          "vendor": "MeetingTools KG",
          "contract": "Rahmenvertrag 3"
        }
      ],
      "audit": [
        {
          "at": "2026-02-10T09:30:00Z",
          "who": "Mitarbeitende",
          "what": "Anforderung erfasst"
        },
        {
          "at": "2026-02-10T09:31:00Z",
          "who": "System",
          "what": "Standardfall: sofort freigegeben"
        }
      ]
    },
    {
      "id": "SO-1038",
      "createdAt": "2026-02-09T08:00:00Z",
      "org": "Amt 33",
      "costCenter": "3303",
      "location": "Rathaus (Haus A) · Raum 0.15",
      "purpose": "Neuausstattung Besprechungsraum (Projekt Umzug/Neustrukturierung).",
      "urgency": "soon",
      "status": "Rückfrage",
      "gateReason": "Sonderbedarf · Summe ≥ 25 €",
      "exceptionText": "Whiteboard Wandmontage für Besprechungsraum (Neustrukturierung).",
      "question": {
        "at": "2026-02-09T09:00:00Z",
        "by": "Freigabe",
        "text": "Bitte genauen Montageort (Raum) und Ansprechpartner für Gebäudemanagement ergänzen."
      },
      "items": [
        {
          "id": "A-046",
          "title": "Whiteboard Wandmontage (120×90 cm)",
          "unit": "Stück",
          "qty": 1,
          "price": 199.0,
          "vendor": "MeetingTools KG",
          "contract": "Rahmenvertrag 3"
        },
        {
          "id": "A-038",
          "title": "Whiteboard-Stifte (4er Set)",
          "unit": "Set",
          "qty": 2,
          "price": 4.99,
          "vendor": "MeetingTools KG",
          "contract": "Rahmenvertrag 3"
        }
      ],
      "audit": [
        {
          "at": "2026-02-09T08:00:00Z",
          "who": "Mitarbeitende",
          "what": "Anforderung erfasst"
        },
        {
          "at": "2026-02-09T08:00:00Z",
          "who": "Mitarbeitende",
          "what": "Sonderbedarf begründet"
        },
        {
          "at": "2026-02-09T08:01:00Z",
          "who": "System",
          "what": "Gate im Amt: In Freigabe (Sonderbedarf)"
        },
        {
          "at": "2026-02-09T09:00:00Z",
          "who": "Freigabe",
          "what": "Rückfrage gestellt"
        }
      ]
    },
    {
      "id": "SO-1041",
      "createdAt": "2026-02-06T10:00:00Z",
      "org": "Amt 12",
      "costCenter": "1201",
      "location": "Rathaus (Haus A) · Raum 3.02",
      "purpose": "Drucker/Arbeitsplatz im Personalbüro – Toner und Papier.",
      "urgency": "normal",
      "status": "In Freigabe",
      "gateReason": "Summe ≥ 25 €",
      "items": [
        {
          "id": "A-026",
          "title": "Toner schwarz (Drucker XYZ)",
          "unit": "Stück",
          "qty": 1,
          "price": 59.0,
          "vendor": "PrintLine AG",
          "contract": "Rahmenvertrag 2"
        },
        {
          "id": "A-023",
          "title": "Kopierpapier A4 (500 Blatt)",
          "unit": "Paket",
          "qty": 2,
          "price": 4.79,
          "vendor": "PrintLine AG",
          "contract": "Rahmenvertrag 2"
        }
      ],
      "audit": [
        {
          "at": "2026-02-06T10:00:00Z",
          "who": "Mitarbeitende",
          "what": "Anforderung erfasst"
        },
        {
          "at": "2026-02-06T10:02:00Z",
          "who": "System",
          "what": "Gate im Amt: In Freigabe (Summe ≥ 25 €)"
        }
      ]
    },
    {
      "id": "SO-1030",
      "createdAt": "2026-02-04T07:00:00Z",
      "org": "Amt 43",
      "costCenter": "4302",
      "location": "Schulverwaltung (Haus F) · Raum 2.09",
      "purpose": "Moderations- und Workshopmaterial (Kulturveranstaltung).",
      "urgency": "normal",
      "status": "Freigegeben",
      "items": [
        {
          "id": "A-038",
          "title": "Whiteboard-Stifte (4er Set)",
          "unit": "Set",
          "qty": 2,
          "price": 4.99,
          "vendor": "MeetingTools KG",
          "contract": "Rahmenvertrag 3"
        },
        {
          "id": "A-039",
          "title": "Magnete rund (10er)",
          "unit": "Set",
          "qty": 2,
          "price": 3.99,
          "vendor": "MeetingTools KG",
          "contract": "Rahmenvertrag 3"
        },
        {
          "id": "A-042",
          "title": "Flipchart-Marker (4er Set)",
          "unit": "Set",
          "qty": 1,
          "price": 6.99,
          "vendor": "MeetingTools KG",
          "contract": "Rahmenvertrag 3"
        }
      ],
      "audit": [
        {
          "at": "2026-02-04T07:00:00Z",
          "who": "Mitarbeitende",
          "what": "Anforderung erfasst"
        },
        {
          "at": "2026-02-04T07:01:00Z",
          "who": "System",
          "what": "Standardfall: sofort freigegeben"
        }
      ]
    },
    {
      "id": "SO-1031",
      "createdAt": "2026-02-03T06:00:00Z",
      "org": "Amt 13",
      "costCenter": "1303",
      "location": "Rathaus (Haus A) · Raum 2.06",
      "purpose": "Etiketten/Laminierfolien für Öffentlichkeitsarbeit (Infomaterial).",
      "urgency": "normal",
      "status": "Freigegeben",
      "items": [
        {
          "id": "A-023",
          "title": "Kopierpapier A4 (500 Blatt)",
          "unit": "Paket",
          "qty": 2,
          "price": 4.79,
          "vendor": "PrintLine AG",
          "contract": "Rahmenvertrag 2"
        },
        {
          "id": "A-029",
          "title": "Etiketten A4 (100 Blatt)",
          "unit": "Packung",
          "qty": 1,
          "price": 7.49,
          "vendor": "PrintLine AG",
          "contract": "Rahmenvertrag 2"
        },
        {
          "id": "A-030",
          "title": "Laminierfolien A4 (100)",
          "unit": "Packung",
          "qty": 1,
          "price": 6.99,
          "vendor": "PrintLine AG",
          "contract": "Rahmenvertrag 2"
        }
      ],
      "audit": [
        {
          "at": "2026-02-03T06:00:00Z",
          "who": "Mitarbeitende",
          "what": "Anforderung erfasst"
        },
        {
          "at": "2026-02-03T06:01:00Z",
          "who": "System",
          "what": "Standardfall: sofort freigegeben"
        }
      ]
    },
    {
      "id": "SO-1033",
      "createdAt": "2026-02-02T11:00:00Z",
      "org": "Amt 11",
      "costCenter": "1101",
      "location": "Rathaus (Haus A) · Raum 2.14",
      "purpose": "Standardbedarf Team Finanzen (Ablage/Notizen).",
      "urgency": "normal",
      "status": "Freigegeben",
      "items": [
        {
          "id": "A-008",
          "title": "Post-its (76×76 mm)",
          "unit": "Block",
          "qty": 4,
          "price": 1.29,
          "vendor": "OfficePro GmbH",
          "contract": "Rahmenvertrag 1"
        },
        {
          "id": "A-006",
          "title": "Notizblock A5 (kariert)",
          "unit": "Block",
          "qty": 2,
          "price": 1.79,
          "vendor": "OfficePro GmbH",
          "contract": "Rahmenvertrag 1"
        }
      ],
      "audit": [
        {
          "at": "2026-02-02T11:00:00Z",
          "who": "Mitarbeitende",
          "what": "Anforderung erfasst"
        },
        {
          "at": "2026-02-02T11:01:00Z",
          "who": "System",
          "what": "Standardfall: sofort freigegeben"
        }
      ]
    },
    {
      "id": "SO-1029",
      "createdAt": "2026-01-29T09:00:00Z",
      "org": "Amt 32",
      "costCenter": "3201",
      "location": "Bauhof (Haus D) · Büro 1.02",
      "purpose": "Ordner/Locher für Baustellenakten (Straßenunterhaltung).",
      "urgency": "normal",
      "status": "Im Bestelllauf",
      "items": [
        {
          "id": "A-009",
          "title": "Ordner breit (8 cm)",
          "unit": "Stück",
          "qty": 10,
          "price": 2.59,
          "vendor": "OfficePro GmbH",
          "contract": "Rahmenvertrag 1"
        },
        {
          "id": "A-017",
          "title": "Locher",
          "unit": "Stück",
          "qty": 1,
          "price": 8.99,
          "vendor": "OfficePro GmbH",
          "contract": "Rahmenvertrag 1"
        }
      ],
      "audit": [
        {
          "at": "2026-01-29T09:00:00Z",
          "who": "Mitarbeitende",
          "what": "Anforderung erfasst"
        },
        {
          "at": "2026-01-29T09:05:00Z",
          "who": "Freigabe",
          "what": "Freigegeben"
        },
        {
          "at": "2026-01-30T11:00:00Z",
          "who": "Zentrale Beschaffung",
          "what": "Bestelllauf gestartet"
        }
      ]
    },
    {
      "id": "SO-1019",
      "createdAt": "2026-01-18T07:00:00Z",
      "org": "Amt 41",
      "costCenter": "4101",
      "location": "Sozialamt (Haus A) · Raum 2.18",
      "purpose": "Papier/Laminierfolien für Antragsunterlagen (Sozialhilfe).",
      "urgency": "normal",
      "status": "Abgeschlossen",
      "poNumbers": [
        "PO-2026-1999"
      ],
      "items": [
        {
          "id": "A-023",
          "title": "Kopierpapier A4 (500 Blatt)",
          "unit": "Paket",
          "qty": 6,
          "price": 4.79,
          "vendor": "PrintLine AG",
          "contract": "Rahmenvertrag 2"
        },
        {
          "id": "A-030",
          "title": "Laminierfolien A4 (100)",
          "unit": "Packung",
          "qty": 1,
          "price": 6.99,
          "vendor": "PrintLine AG",
          "contract": "Rahmenvertrag 2"
        }
      ],
      "audit": [
        {
          "at": "2026-01-18T07:00:00Z",
          "who": "Mitarbeitende",
          "what": "Anforderung erfasst"
        },
        {
          "at": "2026-01-18T07:02:00Z",
          "who": "Freigabe",
          "what": "Freigegeben"
        },
        {
          "at": "2026-01-19T07:00:00Z",
          "who": "Zentrale Beschaffung",
          "what": "Bestelllauf gestartet"
        },
        {
          "at": "2026-01-19T08:00:00Z",
          "who": "Zentrale Beschaffung",
          "what": "Bestellt (PO-2026-1999)"
        },
        {
          "at": "2026-01-22T07:00:00Z",
          "who": "Lieferung",
          "what": "Geliefert"
        },
        {
          "at": "2026-01-22T07:02:00Z",
          "who": "System",
          "what": "Abgeschlossen"
        }
      ]
    }
  ]
};


/* ------------------------------------------------------------
   v0.10: Historische Bestelldaten (12 Monate) für Dashboard/Periode

   - Diese Daten werden NICHT in "Meine Anforderungen" angezeigt.
   - Sie dienen nur dazu, dass die KPI/Visuals sofort „leben“.
   - Der operative Demo-Flow bleibt unverändert:
     Mitarbeitende → (Gate) → Freigabe → Bestelllauf → Bestellung auslösen.
------------------------------------------------------------ */
(function(){
  const mock = MOCK;

  // Skip if already present (e.g. localStorage seeded)
  if(Array.isArray(mock.historyOrders) && mock.historyOrders.length) return;

  const catalog = Array.isArray(mock.catalog) ? mock.catalog : [];
  const suppliers = Array.isArray(mock.suppliers) ? mock.suppliers : [];
  const vendorNames = suppliers.map(s=>s.name).filter(Boolean);

  // Maps for quick lookup
  const byVendor = {};
  const byId = {};
  for(const it of catalog){
    if(!it || !it.vendor) continue;
    if(!byVendor[it.vendor]) byVendor[it.vendor] = [];
    byVendor[it.vendor].push(it);
    byId[it.id] = it;
  }

  // --- Deterministic PRNG (stable demo data) ---
  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Seed: fixed but "modern" enough – feel free to change for different demo worlds
  const rnd = mulberry32(20260212);

  function r(){ return rnd(); }
  function chance(p){ return r() < p; }
  function int(min, max){ return Math.floor(r() * (max - min + 1)) + min; }
  function pick(arr){ return arr[int(0, arr.length - 1)]; }

  function sampleUnique(arr, k){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(r() * (i+1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a.slice(0, Math.max(0, Math.min(k, a.length)));
  }

  function pad4(n){ return String(n).padStart(4, "0"); }
  function iso(d){ return d.toISOString(); }
  function addMinutes(d, m){ const x = new Date(d); x.setMinutes(x.getMinutes() + m); return x; }
  function addDays(d, dd){ const x = new Date(d); x.setDate(x.getDate() + dd); return x; }

  // Demo organisations (Exempla): aus orgModel abgeleitet
  // Format: { org: "Amt 11", cost:["1101"...], loc:["…"] }
  const orgModel = (mock && mock.orgModel) || {};
  const orgs = [];
  for(const d of (orgModel.departments || [])){
    for(const u of (d.units || [])){
      orgs.push({
        org: u.label,
        cost: (u.costCenters || []).map(c => c.code),
        loc: (u.locations || []).slice()
      });
    }
  }

  // Purpose pool: makes orders more plausible & helps reviewers quickly understand "why"
  const purposes = [
    "Öffentlicher Kopierer im Flur – Verbrauchsmaterial",
    "Ersatzbedarf Arbeitsplatz (Standardverbrauch)",
    "Projekt/Workshop – Moderationsmaterial",
    "Neuausstattung Besprechungsraum",
    "Publikumsverkehr – Formulare/Unterlagen",
    "Archiv/Akten – Ordner/Registratur",
    "Veranstaltung – Beschilderung/Etiketten",
    "Teeküche/Hygiene – Verbrauchsmaterial"
  ];

  // Anchor: "heute" für die Demo-Zeitachse
  const anchor = new Date();
  anchor.setHours(12,0,0,0);

  // 12 Monate zurück (inkl. aktueller Monat)
  const start = new Date(anchor);
  start.setMonth(start.getMonth() - 11);
  start.setDate(1);
  start.setHours(12,0,0,0);

  // PO-Nummern: getrennt pro Jahr, bewusst < 2000, damit manuelle POs ab 2001 nicht kollidieren
  const poSeqByYear = {};
  function nextPo(d){
    const y = d.getFullYear();
    if(!poSeqByYear[y]){
      poSeqByYear[y] = (y === anchor.getFullYear()) ? 1200 : 700;
    }
    const n = poSeqByYear[y]++;
    return `PO-${y}-${pad4(n)}`;
  }

  function qtyForItem(it){
    const p = Number(it && it.price || 0);
    if(p <= 1) return int(5, 30);
    if(p <= 5) return int(1, 15);
    if(p <= 25) return int(1, 6);
    return int(1, 2);
  }

  function computeTotals(items){
    const byV = {};
    for(const it of items){
      const v = it.vendor || "Unbekannt";
      if(!byV[v]) byV[v] = { total: 0, lineCount: 0, qty: 0, contract: it.contract || "" };
      byV[v].total += Number(it.price) * Number(it.qty || 0);
      byV[v].lineCount += 1;
      byV[v].qty += Number(it.qty || 0);
      if(!byV[v].contract) byV[v].contract = it.contract || "";
    }
    return byV;
  }

  const threshold = Number((mock.meta && mock.meta.gateThreshold) || 25);

  const historyOrders = [];
  let seq = 2000;

  // iterate month by month
  const cur = new Date(start);
  while(cur.getTime() <= anchor.getTime()){
    const year = cur.getFullYear();
    const month = cur.getMonth();
    const lastDay = new Date(year, month+1, 0).getDate();

    // Monatsvolumen: leicht variierend
    const count = int(14, 26);

    for(let i=0;i<count;i++){
      const day = int(1, lastDay);
      const created = new Date(year, month, day, int(7, 16), int(0, 59), 0, 0);

      // Vendors per order: 1 in ~55%, 2 in ~35%, 3 in ~10%
      const vCount = chance(0.55) ? 1 : (chance(0.78) ? 2 : 3);
      const vendors = sampleUnique(vendorNames, vCount);

      // Build items
      const items = [];
      for(const v of vendors){
        const pool = byVendor[v] || [];
        if(pool.length === 0) continue;

        const itemsPerVendor = int(1, 3);
        const picks = sampleUnique(pool, Math.min(itemsPerVendor, pool.length));

        for(const it of picks){
          // Special item appears rarely (but enough to be visible in KPIs)
          if(it && it.special && !chance(0.22)) continue;

          const qty = qtyForItem(it);
          items.push({
            id: it.id,
            title: it.title,
            unit: it.unit,
            qty,
            price: it.price,
            vendor: it.vendor,
            contract: it.contract
          });
        }
      }

      // ensure at least one item
      if(items.length === 0){
        const v = vendors[0] || vendorNames[0];
        const pool = byVendor[v] || catalog;
        const it = pool && pool.length ? pick(pool) : null;
        if(it){
          items.push({
            id: it.id,
            title: it.title,
            unit: it.unit,
            qty: qtyForItem(it),
            price: it.price,
            vendor: it.vendor,
            contract: it.contract
          });
        }
      }

      const totalsByVendor = computeTotals(items);
      const total = Object.values(totalsByVendor).reduce((s,x)=> s + x.total, 0);

      const hasSpecial = items.some(x => {
        const c = byId[x.id];
        return c && c.special;
      });

      const urgency = chance(0.06) ? "urgent" : (chance(0.14) ? "soon" : "normal");

      // Sonderbedarf-Begründung: immer bei special + selten auch ohne special
      const exceptionText = hasSpecial
        ? "Wandmontage/Technik erforderlich; bitte begründen und freigeben."
        : (chance(0.03) ? "Ausnahmebedarf (Demo): begründet." : "");

      const reasons = [];
      if(hasSpecial) reasons.push("Sonderbedarf");
      if(exceptionText) reasons.push("Sonderbedarf (Begründung)");
      if(total >= threshold) reasons.push(`Summe ≥ ${threshold} €`);
      if(urgency === "urgent") reasons.push("Dringlichkeit: dringend");

      const needsGate = reasons.length > 0;
      const gateReason = needsGate ? reasons.join(" · ") : "";

      const org = pick(orgs);
      const orderId = `SO-${seq++}`;

      const audit = [];
      audit.push({ at: iso(created), who: "Mitarbeitende", what: "Anforderung erfasst" });
      if(exceptionText){
        audit.push({ at: iso(addMinutes(created, 1)), who: "Mitarbeitende", what: "Sonderbedarf begründet" });
      }
      audit.push({ at: iso(addMinutes(created, 2)), who: "System", what: needsGate ? `Gate im Amt: In Freigabe (${gateReason})` : "Standardfall: sofort freigegeben" });

      // (optionales) Gate-Handling
      if(needsGate){
        // selten Rückfrage
        if(chance(0.08)){
          audit.push({ at: iso(addDays(created, int(1,2))), who: "Freigabe", what: "Rückfrage gestellt" });
          audit.push({ at: iso(addDays(created, int(2,4))), who: "Mitarbeitende", what: "Rückfrage beantwortet" });
        }
        audit.push({ at: iso(addDays(created, int(1,5))), who: "Freigabe", what: "Freigegeben" });
      }

      // Bestelllauf: typischerweise wenige Tage später (Di 11:00 als Demo-Cutoff)
      const batchAt = addDays(created, int(1, 7));
      batchAt.setHours(11, 0, 0, 0);
      audit.push({ at: iso(batchAt), who: "Zentrale Beschaffung", what: "Bestelllauf gestartet" });

      const splits = [];
      const poNumbers = [];

      // Abschlusslogik: je "näher an heute", desto wahrscheinlicher noch nicht abgeschlossen
      const daysAgo = Math.floor((anchor.getTime() - batchAt.getTime()) / (1000*60*60*24));
      const recently = daysAgo <= 10;

      for(const [vendor, info] of Object.entries(totalsByVendor)){
        const placedAt = addMinutes(batchAt, int(10, 120));
        const poNumber = nextPo(placedAt);
        poNumbers.push(poNumber);

        // part status
        let partStatus = "Abgeschlossen";
        if(recently){
          partStatus = chance(0.55) ? "Bestellt" : "Abgeschlossen";
        }else if(daysAgo <= 20){
          partStatus = chance(0.20) ? "Bestellt" : "Abgeschlossen";
        }

        splits.push({
          vendor,
          contract: info.contract || "",
          status: partStatus,
          poNumber,
          total: Number(info.total.toFixed(2)),
          lineCount: info.lineCount,
          qty: info.qty
        });

        audit.push({ at: iso(placedAt), who: "Zentrale Beschaffung", what: `Bestellt: ${vendor} (${poNumber})` });
      }

      // Abschluss-Audit: nur wenn wirklich alles abgeschlossen
      const allClosed = splits.every(s => s.status === "Abgeschlossen");
      if(allClosed){
        const doneAt = addDays(batchAt, int(3, 12));
        doneAt.setHours(int(7, 15), int(0, 59), 0, 0);
        audit.push({ at: iso(doneAt), who: "Lieferung", what: "Geliefert" });
        audit.push({ at: iso(addMinutes(doneAt, 2)), who: "System", what: "Abgeschlossen" });
      }

      // Parent status will be aggregated by app.js (syncAggregate on init)
      historyOrders.push({
        id: orderId,
        createdAt: iso(created),
        org: org.org,
        costCenter: pick(org.cost),
        location: pick(org.loc),
        purpose: hasSpecial ? "Neuausstattung Besprechungsraum" : pick(purposes),
        urgency,
        status: allClosed ? "Abgeschlossen" : "Bestellt",
        gateReason: gateReason || undefined,
        exceptionText: exceptionText || undefined,
        items,
        splits,
        poNumbers,
        audit
      });
    }

    cur.setMonth(cur.getMonth() + 1);
  }

  mock.historyOrders = historyOrders;
})();

