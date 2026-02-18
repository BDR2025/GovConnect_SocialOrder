/* social_order_v0.19.3 · apps/org_organisation (ESM)
   Organisation – interaktives Organigramm (Kartenbaum) + Detailpanel.

   Anforderungen:
   - Fachbereiche → Ämter als Kartenbaum
   - Klick auf Knoten zeigt Details (Leitung, Mitarbeitende, Kostenstellen)
   - Verlinkung in andere Apps (setzt Filter, springt zur Route)
*/

import { escapeHtml } from "../core/utils.js";
import { buildPeopleDirectory, presenceBadge, findPerson } from "../domain/people.js";
import { openPersonModal } from "./peo_people.js";

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

function ensureUi(state){
  if(!state.ui) state.ui = {};
  if(!state.ui.org){
    state.ui.org = { selType: "org", selId: "org" };
  }
  return state.ui.org;
}

function rolePill(label){
  return `<span class="rolePill rolePill--sm">${escapeHtml(label)}</span>`;
}

function nodeSelected(ui, type, id){
  return String(ui.selType) === String(type) && String(ui.selId) === String(id);
}

function setSelected(ui, state, saveState, type, id){
  ui.selType = String(type || "org");
  ui.selId = String(id || "org");
  saveState();
}

function personLinkHtml(personId, name){
  if(!personId) return `<span class="muted">—</span>`;
  return `<button class="orgLink" type="button" data-open-person="${escapeHtml(String(personId))}">${escapeHtml(name || "—")}</button>`;
}

function actionBtn(label, route, { primary = false } = {}){
  const cls = primary ? "btn btn--primary" : "btn";
  return `<button class="${cls}" type="button" data-nav="${escapeHtml(route)}">${escapeHtml(label)}</button>`;
}

function orgNodeHtml({ type, id, kicker = "", title = "", leadHtml = "", pills = "", meta = "" , selected = false }){
  const cls = `orgNode card ${selected ? "is-selected" : ""}`;
  return `
    <div class="${cls}" data-org-type="${escapeHtml(type)}" data-org-id="${escapeHtml(id)}" tabindex="0" role="button">
      <div class="card__body">
        ${kicker ? `<div class="orgNode__kicker muted small">${escapeHtml(kicker)}</div>` : ""}
        <div class="orgNode__title">${escapeHtml(title)}</div>
        ${leadHtml ? `<div class="orgNode__lead">Leitung: ${leadHtml}</div>` : ""}
        ${pills ? `<div class="rolePills" style="margin-top:6px;">${pills}</div>` : ""}
        ${meta ? `<div class="orgNode__meta muted small" style="margin-top:6px;">${meta}</div>` : ""}
      </div>
    </div>
  `;
}

function unitLabel(u){
  if(!u) return "—";
  const lbl = u.label ? String(u.label) : String(u.id || "");
  const nm = u.name ? String(u.name) : "";
  return nm ? `${lbl} · ${nm}` : lbl;
}

function deptLabel(d){
  if(!d) return "—";
  const nm = d.name ? String(d.name) : String(d.id || "");
  return nm;
}

export function mountOrganisation(ctx){
  const { state, saveState, navTo, openModal, people, leadership, orgModel } = ctx;

  const ui = ensureUi(state);

  const rootNameEl = document.getElementById("org-root-name");
  if(rootNameEl && orgModel && orgModel.orgName) rootNameEl.textContent = String(orgModel.orgName);

  const resetBtn = document.getElementById("org-reset");
  if(resetBtn){
    resetBtn.addEventListener("click", ()=>{
      setSelected(ui, state, saveState, "org", "org");
      render();
    });
  }

  const rootNode = document.querySelector("[data-org-type='org'][data-org-id='org']");
  if(rootNode){
    rootNode.addEventListener("click", ()=>{
      setSelected(ui, state, saveState, "org", "org");
      render();
    });
    rootNode.addEventListener("keydown", (e)=>{
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        setSelected(ui, state, saveState, "org", "org");
        render();
      }
    });
  }

  const chartEl = document.getElementById("org-depts");
  const detailEl = document.getElementById("org-detail");
  if(!chartEl || !detailEl) return;

  // Build directory once per mount
  const peopleDir = buildPeopleDirectory({ people, orgModel });
  const personById = (id)=> findPerson(peopleDir, id);

  function deptLeadId(deptId){
    return leadership && leadership.deptLeadByDeptId ? leadership.deptLeadByDeptId[String(deptId)] : null;
  }

  function unitLeadId(unitId){
    return leadership && leadership.unitLeadByUnitId ? leadership.unitLeadByUnitId[String(unitId)] : null;
  }

  function employeesOfUnit(unitId){
    return peopleDir.filter(p => p && String(p.unitId || "") === String(unitId));
  }

  function employeesOfDept(deptId){
    return peopleDir.filter(p => p && String(p.deptId || "") === String(deptId));
  }

  function select(type, id){
    setSelected(ui, state, saveState, type, id);
    render();
  }

  function bindNodeEvents(){
    chartEl.querySelectorAll("[data-org-type][data-org-id]").forEach(el=>{
      el.addEventListener("click", (e)=>{
        const t = e.target;
        if(t && t.closest && t.closest("[data-open-person]")) return;
        const type = el.getAttribute("data-org-type");
        const id = el.getAttribute("data-org-id");
        if(type && id) select(type, id);
      });
      el.addEventListener("keydown", (e)=>{
        if(e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        const type = el.getAttribute("data-org-type");
        const id = el.getAttribute("data-org-id");
        if(type && id) select(type, id);
      });
    });

    document.querySelectorAll("[data-open-person]").forEach(btn=>{
      btn.addEventListener("click", (e)=>{
        e.preventDefault();
        e.stopPropagation();
        const pid = btn.getAttribute("data-open-person");
        if(pid) openPersonModal({ openModal, leadership }, peopleDir, pid);
      });
    });

    detailEl.querySelectorAll("[data-nav]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const route = btn.getAttribute("data-nav");
        if(!route) return;
        navTo(route);
      });
    });

    detailEl.querySelectorAll("[data-open-people-unit]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const unit = btn.getAttribute("data-open-people-unit");
        if(!unit) return;
        navTo(`/personen?unit=${encodeURIComponent(unit)}`);
      });
    });

    detailEl.querySelectorAll("[data-open-people-dept]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const dept = btn.getAttribute("data-open-people-dept");
        if(!dept) return;
        navTo(`/personen?dept=${encodeURIComponent(dept)}`);
      });
    });

    detailEl.querySelectorAll("[data-open-orders-search]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const q = btn.getAttribute("data-open-orders-search");
        if(!q) return;
        if(!state.ui) state.ui = {};
        state.ui.ordersFilter = "all";
        state.ui.ordersSearch = q;
        saveState();
        navTo("/app/orders");
      });
    });
  }

  function renderChart(){
    const deps = (orgModel && Array.isArray(orgModel.departments)) ? orgModel.departments : [];
    chartEl.innerHTML = deps.map(d=>{
      const deptId = String(d.id);
      const leadId = deptLeadId(deptId);
      const lead = leadId ? personById(leadId) : null;

      const units = Array.isArray(d.units) ? d.units : [];
      const empCount = employeesOfDept(deptId).length;

      const deptNode = orgNodeHtml({
        type: "dept",
        id: deptId,
        kicker: deptId,
        title: deptLabel(d),
        leadHtml: lead ? personLinkHtml(leadId, lead.name) : "",
        pills: lead ? rolePill(`Fachbereichsleitung`) : "",
        meta: `${units.length} Ämter · ${empCount} Mitarbeitende`,
        selected: nodeSelected(ui, "dept", deptId)
      });

      const unitsHtml = units.map((u, idx)=>{
        const unitId = String(u.id);
        const uLeadId = unitLeadId(unitId);
        const uLead = uLeadId ? personById(uLeadId) : null;
        const isDeptFirst = idx === 0;

        const pills = [];
        if(uLeadId) pills.push(rolePill("Amtsleitung"));
        if(isDeptFirst) pills.push(rolePill("Fachbereichsleitung"));

        const ccCount = (u.costCenters || []).length;
        const emp = employeesOfUnit(unitId).length;

        return orgNodeHtml({
          type: "unit",
          id: unitId,
          kicker: u.label || unitId,
          title: String(u.name || ""),
          leadHtml: uLead ? personLinkHtml(uLeadId, uLead.name) : "",
          pills: pills.join(""),
          meta: `${emp} Mitarbeitende · ${ccCount} Kostenstellen`,
          selected: nodeSelected(ui, "unit", unitId)
        });
      }).join("");

      return `<div class="orgCol">
        ${deptNode}
        <div class="orgUnits">${unitsHtml}</div>
      </div>`;
    }).join("");

    bindNodeEvents();
  }

  function renderDetailOrg(){
    const deps = (orgModel && Array.isArray(orgModel.departments)) ? orgModel.departments : [];
    const totalUnits = deps.reduce((n, d)=> n + ((d.units||[]).length), 0);
    const totalPeople = peopleDir.length;

    detailEl.innerHTML = `
      <div class="card">
        <div class="card__body">
          <div class="orgDetailHeader">
            <div>
              <div class="orgDetailTitle">${escapeHtml(orgModel && orgModel.orgName ? orgModel.orgName : "Organisation")}</div>
              <div class="orgDetailMeta">Gesamtansicht · ${escapeHtml(String(deps.length))} Fachbereiche · ${escapeHtml(String(totalUnits))} Ämter · ${escapeHtml(String(totalPeople))} Personen</div>
            </div>
          </div>

          <div class="orgActions">
            ${actionBtn("Kalender", "/kalender")}
            ${actionBtn("Personen", "/personen")}
            ${actionBtn("Dokumente", "/dokumente")}
            ${actionBtn("Social Order", "/app/start", { primary: true })}
          </div>

          <div class="orgList" style="margin-top:12px;">
            ${deps.map(d=>{
              const deptId = String(d.id);
              const leadId = deptLeadId(deptId);
              const lead = leadId ? personById(leadId) : null;
              const units = Array.isArray(d.units) ? d.units : [];
              return `
                <div class="orgListItem" data-org-type="dept" data-org-id="${escapeHtml(deptId)}" tabindex="0" role="button">
                  <div class="orgListItem__left">
                    <div class="orgListItem__title">${escapeHtml(deptLabel(d))}</div>
                    <div class="orgListItem__meta">${units.length} Ämter${lead ? " · Leitung: " + escapeHtml(lead.name) : ""}</div>
                  </div>
                  <div class="muted small">${escapeHtml(deptId)}</div>
                </div>`;
            }).join("")}
          </div>
        </div>
      </div>
    `;

    detailEl.querySelectorAll("[data-org-type='dept'][data-org-id]").forEach(el=>{
      el.addEventListener("click", ()=>{
        const id = el.getAttribute("data-org-id");
        if(id) select("dept", id);
      });
      el.addEventListener("keydown", (e)=>{
        if(e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        const id = el.getAttribute("data-org-id");
        if(id) select("dept", id);
      });
    });

    bindNodeEvents();
  }

  function renderDetailDept(deptId){
    const deps = (orgModel && Array.isArray(orgModel.departments)) ? orgModel.departments : [];
    const d = deps.find(x => x && String(x.id) === String(deptId)) || null;
    if(!d){
      renderDetailOrg();
      return;
    }

    const leadId = deptLeadId(deptId);
    const lead = leadId ? personById(leadId) : null;

    const units = Array.isArray(d.units) ? d.units : [];
    const emps = employeesOfDept(deptId);

    detailEl.innerHTML = `
      <div class="card">
        <div class="card__body">
          <div class="orgDetailHeader">
            <div>
              <div class="orgDetailTitle">${escapeHtml(deptLabel(d))}</div>
              <div class="orgDetailMeta">${escapeHtml(String(deptId))} · ${escapeHtml(String(units.length))} Ämter · ${escapeHtml(String(emps.length))} Personen</div>
            </div>
          </div>

          <div style="margin-top:10px;">
            <div class="label">Fachbereichsleitung</div>
            <div>${lead ? personLinkHtml(leadId, lead.name) : "<span class='muted'>—</span>"}</div>
          </div>

          <div class="orgActions">
            <button class="btn" type="button" data-open-people-dept="${escapeHtml(String(deptId))}">Personen im Fachbereich</button>
            <button class="btn" type="button" data-open-orders-search="${escapeHtml(String(d.name || deptId))}">Social Order</button>
            <button class="btn" type="button" data-nav="/kalender">Kalender</button>
            <button class="btn btn--primary" type="button" data-nav="/dokumente">Dokumente</button>
          </div>

          <div class="orgList">
            ${units.map(u=>{
              const uid = String(u.id);
              const leadUId = unitLeadId(uid);
              const leadU = leadUId ? personById(leadUId) : null;
              const emp = employeesOfUnit(uid).length;
              const cc = (u.costCenters || []).length;
              return `
                <div class="orgListItem" data-org-type="unit" data-org-id="${escapeHtml(uid)}" tabindex="0" role="button">
                  <div class="orgListItem__left">
                    <div class="orgListItem__title">${escapeHtml(unitLabel(u))}</div>
                    <div class="orgListItem__meta">${emp} Mitarbeitende · ${cc} Kostenstellen${leadU ? " · Leitung: " + escapeHtml(leadU.name) : ""}</div>
                  </div>
                  <div class="muted small">${escapeHtml(uid)}</div>
                </div>`;
            }).join("")}
          </div>
        </div>
      </div>
    `;

    detailEl.querySelectorAll("[data-org-type='unit'][data-org-id]").forEach(el=>{
      el.addEventListener("click", ()=>{
        const id = el.getAttribute("data-org-id");
        if(id) select("unit", id);
      });
      el.addEventListener("keydown", (e)=>{
        if(e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        const id = el.getAttribute("data-org-id");
        if(id) select("unit", id);
      });
    });

    bindNodeEvents();
  }

  function renderDetailUnit(unitId){
    const deps = (orgModel && Array.isArray(orgModel.departments)) ? orgModel.departments : [];
    let d = null;
    let u = null;
    let idxInDept = -1;
    for(const dep of deps){
      const units = Array.isArray(dep.units) ? dep.units : [];
      const idx = units.findIndex(x => x && String(x.id) === String(unitId));
      if(idx >= 0){
        d = dep;
        u = units[idx];
        idxInDept = idx;
        break;
      }
    }
    if(!u){
      renderDetailOrg();
      return;
    }

    const deptId = d ? String(d.id) : "";
    const leadUId = unitLeadId(unitId);
    const leadU = leadUId ? personById(leadUId) : null;

    const isDeptFirst = idxInDept === 0;

    const emps = employeesOfUnit(unitId);
    const cc = Array.isArray(u.costCenters) ? u.costCenters : [];

    detailEl.innerHTML = `
      <div class="card">
        <div class="card__body">
          <div class="orgDetailHeader">
            <div>
              <div class="orgDetailTitle">${escapeHtml(unitLabel(u))}</div>
              <div class="orgDetailMeta">${escapeHtml(deptLabel(d))}${deptId ? " · " + escapeHtml(deptId) : ""}</div>
            </div>
          </div>

          <div class="grid grid--2" style="margin-top:10px;">
            <div>
              <div class="label">Leitung</div>
              <div>${leadU ? personLinkHtml(leadUId, leadU.name) : "<span class='muted'>—</span>"}</div>
              <div style="margin-top:8px;" class="rolePills">
                ${rolePill("Amtsleitung")}
                ${isDeptFirst ? rolePill("Fachbereichsleitung") : ""}
              </div>
            </div>
            <div>
              <div class="label">Schnellaktionen</div>
              <div class="orgActions" style="margin-top:6px;">
                <button class="btn" type="button" data-open-people-unit="${escapeHtml(String(unitId))}">Personen im Amt</button>
                <button class="btn" type="button" data-open-orders-search="${escapeHtml(String(u.label || unitId))}">Social Order</button>
                <button class="btn" type="button" data-nav="/kalender">Kalender</button>
              </div>
            </div>
          </div>

          <div style="margin-top:12px;">
            <div class="label">Aufgaben &amp; Kostenstellen</div>
            ${cc.length ? `
              <div class="orgList">
                ${cc.map(x=>{
                  const code = escapeHtml(String(x.code || ""));
                  const name = escapeHtml(String(x.name || ""));
                  return `<div class="orgListItem">
                    <div class="orgListItem__left">
                      <div class="orgListItem__title">${code}</div>
                      <div class="orgListItem__meta">${name}</div>
                    </div>
                    <button class="btn btn--small" type="button" data-open-orders-search="${code}">SO</button>
                  </div>`;
                }).join("")}
              </div>
            ` : `<div class="muted">Keine Kostenstellen hinterlegt.</div>`}
          </div>

          <div style="margin-top:12px;">
            <div class="label">Mitarbeitende (${escapeHtml(String(emps.length))})</div>
            <div class="orgPeople">
              ${emps.slice(0, 10).map(p=>{
                const st = presenceBadge(p.presence);
                const meta = `${p.unitLabel || ""}${p.title ? " · " + p.title : ""}`;
                return `
                  <div class="orgPerson" data-open-person="${escapeHtml(String(p.id))}" tabindex="0" role="button">
                    <div class="orgPerson__left">
                      <div class="orgAvatar">${escapeHtml((p.initials || "SO").slice(0,2))}</div>
                      <div style="min-width:0;">
                        <div class="orgPerson__name">${escapeHtml(p.name)}</div>
                        <div class="orgPerson__meta">${escapeHtml(meta)}</div>
                      </div>
                    </div>
                    <div class="orgPerson__right">
                      <div class="personCard__status"><span class="${st.dot}"></span> ${escapeHtml(st.label)}</div>
                    </div>
                  </div>`;
              }).join("")}
              ${emps.length > 10 ? `<div class="muted small">Weitere Mitarbeitende: ${escapeHtml(String(emps.length - 10))} … (öffnet sich im Personen‑Verzeichnis)</div>` : ""}
              ${emps.length ? `<button class="btn" type="button" data-open-people-unit="${escapeHtml(String(unitId))}">Alle Mitarbeitenden im Personen‑Verzeichnis</button>` : ""}
            </div>
          </div>

        </div>
      </div>
    `;

    detailEl.querySelectorAll("[data-open-person]").forEach(el=>{
      el.addEventListener("click", (e)=>{
        e.preventDefault();
        e.stopPropagation();
        const pid = el.getAttribute("data-open-person");
        if(pid) openPersonModal({ openModal, leadership }, peopleDir, pid);
      });
      el.addEventListener("keydown", (e)=>{
        if(e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        const pid = el.getAttribute("data-open-person");
        if(pid) openPersonModal({ openModal, leadership }, peopleDir, pid);
      });
    });

    bindNodeEvents();
  }

  function renderDetail(){
    if(ui.selType === "dept") return renderDetailDept(ui.selId);
    if(ui.selType === "unit") return renderDetailUnit(ui.selId);
    return renderDetailOrg();
  }

  function applyQuerySelection(){
    const q = parseHashQuery();
    if(q.unit){
      setSelected(ui, state, saveState, "unit", q.unit);
      return;
    }
    if(q.dept){
      setSelected(ui, state, saveState, "dept", q.dept);
      return;
    }
  }

  function render(){
    renderChart();
    renderDetail();
  }

  applyQuerySelection();
  render();
}
