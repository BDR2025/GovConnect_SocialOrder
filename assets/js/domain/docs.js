/* social_order_v0.19.2 · domain/docs (ESM)
   Dokumente als Demo-Datenmodell.
   Ziel: projektfähig + erweiterbar (weitere Projekte/Dokumente später).

   Struktur:
   - Projekte (id, name)
   - Dokumente (id, projectId, type, title, file)

   Hinweis: Die Dateien liegen statisch unter assets/docs/…
*/

function bytesToLabel(bytes){
  const b = Number(bytes || 0);
  if(!b || b < 0) return "—";
  if(b >= 1024*1024) return (b/(1024*1024)).toFixed(1).replace(".",",") + " MB";
  if(b >= 1024) return Math.round(b/1024) + " KB";
  return b + " B";
}

export const DOC_PROJECTS = [
  {
    id: "social_order",
    name: "Social Order",
    owner: "Projekt Digitalisierung",
    hint: "Projektunterlagen und Rahmenverträge",
    docs: [
      {
        id: "so_info",
        projectId: "social_order",
        type: "pdf",
        title: "Mitarbeiterinformation: Projekt Social Order",
        subtitle: "Information der Oberbürgermeisterin",
        file: "assets/docs/projects/social-order/doc_project_SO_info.pdf",
        owner: "Oberbürgermeisterin",
        changed: "18.02.2026",
        sizeBytes: 178210,
        tags: ["Projekt", "Information"]
      },
      {
        id: "rv1_officepro",
        projectId: "social_order",
        type: "pdf",
        title: "Rahmenvertrag 1: OfficePro GmbH",
        subtitle: "Standardbürobedarf, Basissortiment",
        file: "assets/docs/projects/social-order/doc_contract1_info.pdf",
        owner: "Oberbürgermeisterin",
        changed: "18.02.2026",
        sizeBytes: 170992,
        tags: ["Rahmenvertrag", "OfficePro"]
      },
      {
        id: "rv2_printline",
        projectId: "social_order",
        type: "pdf",
        title: "Rahmenvertrag 2: PrintLine AG",
        subtitle: "Papier und Druckerzubehör",
        file: "assets/docs/projects/social-order/doc_contract2_info.pdf",
        owner: "Oberbürgermeisterin",
        changed: "18.02.2026",
        sizeBytes: 170558,
        tags: ["Rahmenvertrag", "PrintLine"]
      },
      {
        id: "rv3_meetingtools",
        projectId: "social_order",
        type: "pdf",
        title: "Rahmenvertrag 3: MeetingTools KG",
        subtitle: "Konferenz und Meetingbedarf",
        file: "assets/docs/projects/social-order/doc_contract3_info.pdf",
        owner: "Oberbürgermeisterin",
        changed: "18.02.2026",
        sizeBytes: 171013,
        tags: ["Rahmenvertrag", "MeetingTools"]
      }
    ]
  },
  {
    id: "dokumente_app",
    name: "Dokumente",
    owner: "Projekt Digitalisierung",
    hint: "Dateien-App, Vorschau, Projektordner",
    docs: [
      {
        id: "docs_info",
        projectId: "dokumente_app",
        type: "pdf",
        title: "Projekt: Dokumente-App",
        subtitle: "Kurzinfo und Zielbild",
        file: "assets/docs/projects/dokumente/doc_project_doc_info.pdf",
        owner: "Projektteam",
        changed: "18.02.2026",
        sizeBytes: 171309,
        tags: ["Projekt", "Dokumente"]
      }
    ]
  },
  {
    id: "personen_app",
    name: "Personen",
    owner: "Projekt Digitalisierung",
    hint: "Mitarbeitendenverzeichnis und Stammdaten",
    docs: [
      {
        id: "peo_info",
        projectId: "personen_app",
        type: "pdf",
        title: "Projekt: Personen-App",
        subtitle: "Kurzinfo und Zielbild",
        file: "assets/docs/projects/personen/doc_project_peo_info.pdf",
        owner: "Projektteam",
        changed: "18.02.2026",
        sizeBytes: 171338,
        tags: ["Projekt", "Personen"]
      }
    ]
  },
  {
    id: "room_booking",
    name: "Raumbuchung",
    owner: "Organisation",
    hint: "Räume, Ausstattung, Termine",
    docs: []
  },
  {
    id: "fleet",
    name: "Fuhrpark",
    owner: "Zentrale Dienste",
    hint: "Dienstwagen und Poolfahrzeuge",
    docs: []
  }
];

export function listProjects(){
  return DOC_PROJECTS.map(p=>({ id:p.id, name:p.name, owner:p.owner, hint:p.hint, count:(p.docs||[]).length }));
}

export function docsForProject(projectId){
  const pid = String(projectId || "").trim();
  const p = DOC_PROJECTS.find(x=> x.id === pid) || DOC_PROJECTS[0];
  return (p && Array.isArray(p.docs)) ? p.docs.slice() : [];
}

export function findDoc(docId){
  const id = String(docId || "").trim();
  for(const p of DOC_PROJECTS){
    const d = (p.docs || []).find(x=> x.id === id);
    if(d) return d;
  }
  return null;
}

export function docSizeLabel(doc){
  if(!doc) return "—";
  return bytesToLabel(doc.sizeBytes);
}
