/* social_order_v0.19.2.1 · apps/doc_documents (ESM)
   Dokumente (Drive-Look) – projektfähig + PDF-Vorschau.

   - Projekte links
   - Dateienliste + Vorschau rechts
   - Öffnen als PDF in Vorschau-Panel oder Modal
*/

import { listProjects, docsForProject, findDoc, docSizeLabel } from "../domain/docs.js";

function parseHashQuery(){
  const h = String(location.hash || "");
  const i = h.indexOf("?");
  if(i < 0) return {};
  const q = h.slice(i + 1);
  const out = {};
  q.split("&").forEach(part=>{
    const [k,v] = part.split("=");
    if(!k) return;
    out[decodeURIComponent(k)] = decodeURIComponent(v || "");
  });
  return out;
}

function escapeHtml(s){
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function typeLabel(t){
  const x = String(t || "").toLowerCase();
  if(x === "pdf") return "PDF";
  if(x === "docx") return "DOCX";
  if(x === "pptx") return "PPTX";
  return (t || "Datei");
}

export function mountDocuments(ctx){
  const { state, saveState, openModal } = ctx;

  const projectsEl = document.getElementById("docs-projects");
  const projectNameEl = document.getElementById("docs-project-name");
  const breadcrumbEl = document.getElementById("docs-breadcrumb");
  const searchEl = document.getElementById("docs-search");

  const tbody = document.getElementById("docs-table-body");
  const emptyEl = document.getElementById("docs-empty");

  const previewEl = document.getElementById("docs-preview");

  if(!projectsEl || !tbody || !previewEl) return;

  if(!state.ui) state.ui = {};
  if(!state.ui.docs) state.ui.docs = { projectId: "social_order", docId: "" };

  const query = parseHashQuery();
  const initialProject = query.project || state.ui.docs.projectId || "social_order";
  const initialDoc = query.doc || state.ui.docs.docId || "";

  let currentProjectId = initialProject;
  let currentDocId = initialDoc;
  let q = "";

  if(searchEl){
    searchEl.value = "";
    searchEl.addEventListener("input", ()=>{
      q = String(searchEl.value || "").trim().toLowerCase();
      renderTable();
    });
  }

  function persist(){
    state.ui.docs = { projectId: currentProjectId, docId: currentDocId };
    saveState();
  }

  function selectProject(pid){
    currentProjectId = pid;
    const docs = docsForProject(currentProjectId);
    currentDocId = docs.length ? docs[0].id : "";
    q = "";
    if(searchEl) searchEl.value = "";
    render();
    persist();
  }

  function selectDoc(docId){
    currentDocId = docId;
    renderTable();
    renderPreview();
    persist();
  }

  function renderProjects(){
    const projects = listProjects();
    projectsEl.innerHTML = projects.map(p=>{
      const active = p.id === currentProjectId ? " is-active" : "";
      const meta = p.count ? `${p.count} Dateien` : "—";
      return `<div class="driveProject${active}" data-project="${escapeHtml(p.id)}">
        <div class="driveProject__name">${escapeHtml(p.name)}</div>
        <div class="driveProject__meta">${escapeHtml(meta)}</div>
      </div>`;
    }).join("");

    projectsEl.querySelectorAll("[data-project]").forEach(el=>{
      el.addEventListener("click", ()=>{
        const pid = el.getAttribute("data-project");
        if(pid) selectProject(pid);
      });
    });
  }

  function matches(doc){
    if(!q) return true;
    const hay = `${doc.title||""} ${doc.subtitle||""} ${(doc.tags||[]).join(" ")}`.toLowerCase();
    return hay.includes(q);
  }

  function renderTable(){
    const docs = docsForProject(currentProjectId).filter(matches);

    if(projectNameEl){
      const p = listProjects().find(x=> x.id === currentProjectId);
      projectNameEl.textContent = p ? p.name : "Projekt";
    }
    if(breadcrumbEl){
      const p = listProjects().find(x=> x.id === currentProjectId);
      breadcrumbEl.textContent = p ? `Projekte / ${p.name}` : "Projekte";
    }

    if(!docs.length){
      tbody.innerHTML = "";
      if(emptyEl) emptyEl.style.display = "";
      renderPreview();
      return;
    }

    if(emptyEl) emptyEl.style.display = "none";

    // keep selection valid
    if(currentDocId && !docs.some(d=> d.id === currentDocId)){
      currentDocId = docs[0].id;
    }

    tbody.innerHTML = docs.map(d=>{
      const active = d.id === currentDocId ? " is-selected" : "";
      const name = escapeHtml(d.title);
      const type = escapeHtml(typeLabel(d.type));
      const changed = escapeHtml(d.changed || "—");
      const owner = escapeHtml(d.owner || "—");
      const size = escapeHtml(docSizeLabel(d));

      return `<tr class="is-clickable${active}" data-doc="${escapeHtml(d.id)}">
        <td>
          <div class="docName">${name}</div>
          ${d.subtitle ? `<div class="docSub muted small">${escapeHtml(d.subtitle)}</div>` : ""}
        </td>
        <td>${type}</td>
        <td>${changed}</td>
        <td>${owner}</td>
        <td class="right">${size}</td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll("[data-doc]").forEach(tr=>{
      tr.addEventListener("click", ()=>{
        const id = tr.getAttribute("data-doc");
        if(id) selectDoc(id);
      });
      tr.addEventListener("dblclick", ()=>{
        const id = tr.getAttribute("data-doc");
        if(id) openDocModal(id);
      });
    });

    renderPreview();
  }

  function openDocModal(docId){
    const doc = findDoc(docId);
    if(!doc || !doc.file) return;

    const file = escapeHtml(doc.file);
    const title = escapeHtml(doc.title || "Dokument");

    const html = `
      <div class="docModal">
        <div class="row row--space" style="margin-bottom:10px;">
          <div>
            <div style="font-weight:950;">${title}</div>
            ${doc.subtitle ? `<div class="muted small" style="margin-top:2px;">${escapeHtml(doc.subtitle)}</div>` : ""}
          </div>
          <div class="row" style="gap:8px;">
            <a class="btn" href="${file}" target="_blank" rel="noopener">In neuem Tab</a>
          </div>
        </div>
        <iframe class="docFrame docFrame--modal" src="${file}#view=FitH" title="${title}"></iframe>
      </div>`;

    openModal(html, { title: "Dokument" });
  }

  function renderPreview(){
    const doc = currentDocId ? findDoc(currentDocId) : null;

    if(!doc){
      previewEl.innerHTML = `<div class="callout">
        <div class="callout__title">Keine Auswahl</div>
        <div class="callout__text">Wähle links eine Datei aus, um eine Vorschau zu sehen.</div>
      </div>`;
      return;
    }

    const tags = Array.isArray(doc.tags) ? doc.tags : [];

    previewEl.innerHTML = `
      <div class="docPreview__head">
        <div class="docPreview__title">${escapeHtml(doc.title)}</div>
        ${doc.subtitle ? `<div class="docPreview__sub muted small">${escapeHtml(doc.subtitle)}</div>` : ""}
        <div class="docPreview__meta">
          <span class="pill">${escapeHtml(typeLabel(doc.type))}</span>
          <span class="pill">${escapeHtml(docSizeLabel(doc))}</span>
          <span class="pill">${escapeHtml(doc.changed || "—")}</span>
        </div>
        ${tags.length ? `<div class="docPreview__tags">${tags.map(t=>`<span class="pill">${escapeHtml(t)}</span>`).join(" ")}</div>` : ""}
        <div class="row" style="gap:8px; margin-top:10px;">
          <button class="btn btn--primary" type="button" id="docs-open">Öffnen</button>
          <a class="btn" href="${escapeHtml(doc.file)}" target="_blank" rel="noopener">In neuem Tab</a>
        </div>
      </div>

      <div class="docPreview__frame">
        ${doc.type === "pdf" ? `<iframe class="docFrame" src="${escapeHtml(doc.file)}#view=FitH" title="${escapeHtml(doc.title)}"></iframe>` : `<div class="callout"><div class="callout__title">Keine Vorschau</div><div class="callout__text">Für diesen Dateityp ist in der Demo keine Vorschau verfügbar.</div></div>`}
      </div>
    `;

    const btn = document.getElementById("docs-open");
    if(btn){
      btn.addEventListener("click", ()=> openDocModal(doc.id));
    }
  }

  function render(){
    renderProjects();
    renderTable();
  }

  // initial state: ensure project exists
  const known = listProjects().some(p=> p.id === currentProjectId);
  if(!known) currentProjectId = "social_order";

  // ensure doc exists
  const docs = docsForProject(currentProjectId);
  if(!currentDocId || !docs.some(d=> d.id === currentDocId)){
    currentDocId = docs.length ? docs[0].id : "";
  }

  render();
  persist();
}
