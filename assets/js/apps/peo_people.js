/* social_order_v0.19.2.1 · apps/peo_people (ESM)
   Personen – Mitarbeitendenverzeichnis (Demo) mit Suche, Filter und Paging.
   Kommunikationsfunktionen bleiben bewusst nur Darstellung.

   Trennung:
   - Persona/Login (Testrolle) bleibt in personnel.js / core/context.
   - Dieses Modul rendert das Mitarbeitendenverzeichnis.
*/

import { escapeHtml } from "../core/utils.js";
import { buildPeopleDirectory, findPerson, presenceBadge, flattenOrgUnits } from "../domain/people.js";

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

function parseDeptLabelFromId(deptId){
  const m = String(deptId || "").match(/^FB(\d+)$/i);
  return m ? `Fachbereich ${m[1]}` : (deptId ? String(deptId) : "—");
}

function formatUnitOption(u){
  if(!u) return "—";
  const label = u.label ? String(u.label) : String(u.id || "");
  const name = u.name ? String(u.name) : "";
  return name ? `${label} · ${name}` : label;
}

function ensureUiState(state){
  if(!state.ui) state.ui = {};
  if(!state.ui.people){
    state.ui.people = { tab: "directory", q: "", unit: "all", page: 1 };
  }
  return state.ui.people;
}

function rolePillHtml(label, { small = false } = {}){
  const cls = small ? "rolePill rolePill--sm" : "rolePill";
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

function badgesRowHtml(badges, { small = true } = {}){
  const arr = Array.isArray(badges) ? badges.filter(Boolean) : [];
  if(!arr.length) return "";
  return `<div class="personCard__badges">${arr.map(b => rolePillHtml(String(b), { small })).join("")}</div>`;
}

function personActionsHtml({ personId, includeMail = false, includePhone = true } = {}){
  const pid = escapeHtml(String(personId || ""));
  return `
    <div class="personCard__actions" aria-label="Kontakt">
      <button class="icon-btn icon-btn--sm" type="button" data-person-action="chat" data-person-id="${pid}" title="Chat" aria-label="Chat">
        <span class="icon icon--chat"></span>
      </button>
      ${includePhone ? `
        <button class="icon-btn icon-btn--sm" type="button" data-person-action="call" data-person-id="${pid}" title="Anruf" aria-label="Anruf">
          <span class="icon icon--phone"></span>
        </button>
      ` : ""}
      <button class="icon-btn icon-btn--sm" type="button" data-person-action="video" data-person-id="${pid}" title="Video" aria-label="Video">
        <span class="icon icon--video"></span>
      </button>
      ${includeMail ? `
        <button class="icon-btn icon-btn--sm" type="button" data-person-action="mail" data-person-id="${pid}" title="E‑Mail" aria-label="E‑Mail">
          <span class="icon icon--mail"></span>
        </button>
      ` : ""}
    </div>
  `;
}

function personCardHtml(p, { metaLeft = "", leader = false, badges = [] } = {}){
  const st = presenceBadge(p.presence);
  const cls = leader ? "personCard personCard--leader" : "personCard";
  const meta = metaLeft ? metaLeft : `${p.unitLabel || "—"}${p.title ? " · " + p.title : ""}`;

  return `
    <div class="${cls}" data-person-id="${escapeHtml(p.id)}">
      <div class="personCard__avatar">${escapeHtml(p.initials || "SO")}</div>
      <div class="personCard__main">
        <div class="personCard__name">${escapeHtml(p.name)}</div>
        <div class="personCard__meta">${escapeHtml(meta)}</div>
        ${badgesRowHtml(badges)}
      </div>
      <div class="personCard__right">
        <div class="personCard__status"><span class="${st.dot}"></span> ${escapeHtml(st.label)}</div>
        ${leader ? "" : personActionsHtml({ personId: p.id, includeMail: false, includePhone: true })}
      </div>
    </div>
  `;
}

function computeRoleBadges(p, leadership){
  const badges = [];
  const lid = leadership || {};

  // Amtsleitung
  if(p && p.unitId && lid.unitLeadByUnitId && lid.unitLeadByUnitId[String(p.unitId)]){
    const uid = String(lid.unitLeadByUnitId[String(p.unitId)]);
    if(uid && String(p.id) === uid){
      badges.push(`Amtsleitung · ${p.unitLabel || String(p.unitId)}`);
    }
  }

  // Fachbereichsleitung
  if(p && lid.deptLeadByDeptId){
    for(const deptId of Object.keys(lid.deptLeadByDeptId)){
      const did = String(lid.deptLeadByDeptId[deptId] || "");
      if(did && String(p.id) === did){
        badges.push(`Fachbereichsleitung · ${parseDeptLabelFromId(deptId)}`);
      }
    }
  }

  // Zentrale Beschaffung
  if(p && lid.procurementChiefId && String(p.id) === String(lid.procurementChiefId)){
    badges.push("Leitung · Zentrale Beschaffung");
  }

  // Dedup
  return Array.from(new Set(badges.map(String)));
}

function personModalHtml(p, { roleBadges = [] } = {}){
  const st = presenceBadge(p.presence);
  const unit = p.unitLabel ? `${p.unitLabel}${p.unitName ? " · " + p.unitName : ""}` : "—";
  const dept = p.deptLabel || "—";

  const roles = Array.isArray(roleBadges) ? roleBadges.filter(Boolean) : [];

  return `
    <div class="card" data-person-modal="1" data-person-id="${escapeHtml(p.id)}">
      <div class="card__body">
        <div class="row row--space" style="align-items:flex-start; gap:16px;">
          <div>
            <div style="font-weight:950; font-size:18px;">${escapeHtml(p.name)}</div>
            <div class="muted" style="margin-top:2px;">${escapeHtml(p.title || unit)}</div>
            ${roles.length ? `<div class="rolePills" style="margin-top:8px;">${roles.map(r => rolePillHtml(String(r))).join("")}</div>` : ""}
          </div>

          <div class="personModal__right">
            <div class="personCard__status"><span class="${st.dot}"></span> ${escapeHtml(st.label)}</div>
            ${personActionsHtml({ personId: p.id, includeMail: true, includePhone: true })}
          </div>
        </div>

        <div class="grid grid--2" style="margin-top:14px;">
          <div>
            <div class="label">Organisation</div>
            <div>${escapeHtml(unit)}</div>
          </div>
          <div>
            <div class="label">Fachbereich</div>
            <div>${escapeHtml(dept)}</div>
          </div>
          <div>
            <div class="label">E‑Mail</div>
            <div><a href="mailto:${escapeHtml(p.email)}">${escapeHtml(p.email)}</a></div>
          </div>
          <div>
            <div class="label">Telefon</div>
            <div>${escapeHtml(p.phone)}</div>
          </div>
          <div style="grid-column:1 / -1;">
            <div class="label">Dienstort</div>
            <div>${escapeHtml(p.office || "—")}</div>
          </div>
        </div>

        <div id="person-comm-callout" class="callout" style="display:none;">
          <div class="callout__title">Nur Darstellung</div>
          <div class="callout__text" id="person-comm-text"></div>
        </div>

        <div class="muted small" style="margin-top:10px;">Kontaktfelder sind Mock‑Daten. Kommunikation ist in dieser Demo nicht implementiert.</div>
      </div>
    </div>
  `;
}

export function openPersonModal(ctx, peopleDir, personId){
  const p = findPerson(peopleDir, personId);
  if(!p) return;

  const roleBadges = computeRoleBadges(p, ctx.leadership);
  ctx.openModal(personModalHtml(p, { roleBadges }), { title: "Person" });

  // Wire modal action buttons (within modal only)
  const body = document.getElementById("modal-body");
  const root = body ? body.querySelector("[data-person-modal='1']") : null;
  if(!root) return;

  const callout = root.querySelector("#person-comm-callout");
  const textEl = root.querySelector("#person-comm-text");

  function showHint(action){
    if(!callout || !textEl) return;
    const a = String(action || "");
    const label = a === "chat" ? "Chat" : (a === "call" ? "Anruf" : (a === "video" ? "Videocall" : "E‑Mail"));
    textEl.textContent = `${label} ist in dieser Demo bewusst nicht implementiert.`;
    callout.style.display = "";
  }

  root.querySelectorAll("button[data-person-action]").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const action = btn.getAttribute("data-person-action") || "";
      showHint(action);
    });
  });
}

function mountTabs(ui, state, saveState){
  const wrap = document.getElementById("people-panels");
  if(!wrap) return;

  const btns = Array.from(document.querySelectorAll("[data-people-tab]"));
  const panels = Array.from(wrap.querySelectorAll("[data-people-panel]"));

  function setTab(key){
    ui.tab = key;
    saveState();
    btns.forEach(b => b.classList.toggle("chip--active", b.getAttribute("data-people-tab") === key));
    panels.forEach(p => p.classList.toggle("is-active", p.getAttribute("data-people-panel") === key));
  }

  btns.forEach(b => {
    b.addEventListener("click", () => {
      const key = b.getAttribute("data-people-tab") || "directory";
      setTab(key);
    });
  });

  setTab(ui.tab || "directory");
}

export function mountPeople(ctx){
  const { state, saveState, openModal, people, leadership, orgModel } = ctx;

  const ui = ensureUiState(state);

  // Optional: preselect filter via hash query (e.g., /personen?unit=A11 or ?dept=FB1)
  const query = parseHashQuery();
  if(query && query.unit){
    ui.tab = "directory";
    ui.unit = String(query.unit);
    ui.page = 1;
  }
  if(query && query.dept){
    ui.tab = "directory";
    ui.unit = `dept:${String(query.dept)}`;
    ui.page = 1;
  }

  mountTabs(ui, state, saveState);

  const grid = document.getElementById("people-grid");
  const leadershipEl = document.getElementById("people-leadership");
  const search = document.getElementById("people-search");
  const sel = document.getElementById("people-filter-unit");
  const prev = document.getElementById("people-prev");
  const next = document.getElementById("people-next");
  const info = document.getElementById("people-pageinfo");
  const countEl = document.getElementById("people-count");

  if(!grid || !sel) return;

  // Build directory once per mount.
  const peopleDir = buildPeopleDirectory({ people, orgModel });

  // Units + extras
  const units = flattenOrgUnits(orgModel);
  const EXTRA = [
    { id:"ZB", label:"Zentrale Beschaffung", name:"Zentrale Beschaffung", deptId:"FB1", deptName:"Zentrale Steuerung" },
    { id:"IT", label:"IT‑Service", name:"IT‑Service", deptId:"FB1", deptName:"Zentrale Steuerung" }
  ];
  // Dept options (Fachbereiche) – allows filtering by scope without leaving the People app.
const deptOptions = (orgModel && Array.isArray(orgModel.departments))
  ? orgModel.departments.map(d => ({
      value: `dept:${String(d.id)}`,
      label: `${parseDeptLabelFromId(d.id)} · ${String(d.name || d.id)}`
    }))
  : [];

const unitOptions = [
  { value:"all", label:"Alle" },
  ...deptOptions,
  ...units.map(u => ({ value: u.id, label: formatUnitOption(u) })),
  ...EXTRA.map(u => ({ value: u.id, label: u.name }))
];

  sel.innerHTML = unitOptions.map(o => `<option value="${escapeHtml(String(o.value))}">${escapeHtml(String(o.label))}</option>`).join("");
  sel.value = ui.unit || "all";

  if(search){
    search.value = ui.q || "";
  }

  const perPage = 10;
  let page = Number(ui.page || 1);
  let unit = String(ui.unit || "all");
  let q = String(ui.q || "").trim().toLowerCase();

  const unitToDept = (function(){
    const map = {};
    units.forEach(u => { map[String(u.id)] = String(u.deptId); });
    EXTRA.forEach(u => { map[String(u.id)] = String(u.deptId); });
    return map;
  })();

  function persist(){
    ui.unit = unit;
    ui.q = q;
    ui.page = page;
    saveState();
  }

  function leaderIdsForUnit(unitId){
    const ids = [];
    const lid = leadership || {};

    if(String(unitId) === "ZB"){
      if(lid.procurementChiefId) ids.push(lid.procurementChiefId);
      return ids;
    }
    if(String(unitId) === "IT"){
      return ids;
    }

    const deptId = unitToDept[String(unitId)] || "";
    if(deptId && lid.deptLeadByDeptId && lid.deptLeadByDeptId[deptId]){
      ids.push(lid.deptLeadByDeptId[deptId]);
    }
    if(lid.unitLeadByUnitId && lid.unitLeadByUnitId[String(unitId)]){
      ids.push(lid.unitLeadByUnitId[String(unitId)]);
    }
    // dedup
    return Array.from(new Set(ids.filter(Boolean).map(String)));
  }

  function renderLeadership(){
    if(!leadershipEl) return;
    if(unit === "all" || unit === "IT"){
      leadershipEl.innerHTML = "";
      return;
    }

    const ids = leaderIdsForUnit(unit);
    const cards = [];

    for(const id of ids){
      const p = findPerson(peopleDir, id);
      if(!p) continue;

      let roleLabel = "Leitung";
      const badges = [];

      if(String(unit) === "ZB"){
        roleLabel = "Leitung · Zentrale Beschaffung";
      } else {
        const deptId = unitToDept[String(unit)] || "";
        const deptLabel = deptId ? parseDeptLabelFromId(deptId) : "Fachbereich";

        const lid = leadership || {};
        const deptLeadId = (deptId && lid.deptLeadByDeptId) ? lid.deptLeadByDeptId[deptId] : null;
        const unitLeadId = (lid.unitLeadByUnitId) ? lid.unitLeadByUnitId[String(unit)] : null;

        const deptRole = (deptLeadId && String(id) === String(deptLeadId)) ? `Fachbereichsleitung · ${deptLabel}` : "";
        const unitRole = (unitLeadId && String(id) === String(unitLeadId)) ? `Amtsleitung · ${p.unitLabel || String(unit)}` : "";

        if(unitRole) roleLabel = unitRole;
        else if(deptRole) roleLabel = deptRole;

        // Wenn beide Rollen auf einer Person liegen (Amt 11/21/31/41), zeigen wir zusätzlich die zweite Rolle.
        if(unitRole && deptRole) badges.push(deptRole);
      }

      cards.push(personCardHtml(p, { metaLeft: roleLabel, leader: true, badges }));
    }

    if(!cards.length){
      leadershipEl.innerHTML = "";
      return;
    }

    leadershipEl.innerHTML = `
      <div class="muted mb-8">Leitung</div>
      <div class="peopleLeaders">${cards.join("")}</div>
    `;
  }

  function filteredPeople(){
    const exclude = new Set();
    if(unit !== "all"){
      leaderIdsForUnit(unit).forEach(id => exclude.add(String(id)));
    }

    return peopleDir.filter(p => {
      if(!p || !p.id) return false;
      if(exclude.has(String(p.id))) return false;
      if(unit !== "all" && String(p.unitId || "") !== String(unit)) return false;
      if(!q) return true;
      const hay = `${p.name} ${p.unitLabel} ${p.title} ${p.deptLabel}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function renderGrid(){
    renderLeadership();

    const list = filteredPeople();
    const pages = Math.max(1, Math.ceil(list.length / perPage));
    page = Math.min(Math.max(1, page), pages);

    const start = (page - 1) * perPage;
    const slice = list.slice(start, start + perPage);

    grid.innerHTML = slice.map(p => personCardHtml(p)).join("");

    if(info) info.textContent = `Seite ${page} / ${pages}`;
    if(prev) prev.disabled = page <= 1;
    if(next) next.disabled = page >= pages;

    if(countEl){
      const total = peopleDir.length;
      countEl.textContent = `Angezeigt: ${slice.length} von ${list.length} (gesamt: ${total}).`;
    }
  }

  function openActionModal(action, pid){
    const p = findPerson(peopleDir, pid);
    const who = p ? p.name : "Person";
    const title = action === "chat" ? "Chat" : (action === "call" ? "Anruf" : "Videocall");
    openModal(`
      <div class="callout">
        <div class="callout__title">Nur Darstellung</div>
        <div class="callout__text">${escapeHtml(title)} ist in dieser Demo bewusst nicht implementiert. Interaktiv ist die App <strong>Social Order</strong> sowie das Mitarbeitendenverzeichnis.</div>
      </div>
    `, { title: `${title} · ${who}` });
  }

  // Listeners
  sel.addEventListener("change", () => {
    unit = sel.value || "all";
    page = 1;
    persist();
    renderGrid();
  });

  if(search){
    search.addEventListener("input", () => {
      q = String(search.value || "").trim().toLowerCase();
      page = 1;
      persist();
      renderGrid();
    });
  }

  if(prev) prev.addEventListener("click", () => { if(page > 1){ page--; persist(); renderGrid(); } });
  if(next) next.addEventListener("click", () => { page++; persist(); renderGrid(); });

  // Click behavior (open person modal or action placeholder)
  function handleClick(ev){
    const btn = ev.target.closest("[data-person-action]");
    if(btn){
      const action = btn.getAttribute("data-person-action") || "";
      const card = btn.closest(".personCard");
      const pid = card ? card.getAttribute("data-person-id") : "";
      if(action && pid) openActionModal(action, pid);
      return;
    }

    const card = ev.target.closest(".personCard");
    if(!card) return;
    const pid = card.getAttribute("data-person-id");
    if(pid) openPersonModal(ctx, peopleDir, pid);
  }

  grid.addEventListener("click", handleClick);
  if(leadershipEl) leadershipEl.addEventListener("click", handleClick);

  renderGrid();
}
