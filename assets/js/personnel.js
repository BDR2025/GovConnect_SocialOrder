/*
  Social Order – Personal & Rollen (Mock)
  v0.16 (Originaldaten), ESM-Umstellung in v0.17.6

  Ziel:
  - Eine zentrale, leicht administrierbare Quelle für Personen, Zuordnung (Amt/Fachbereich)
  - Rollen + Sichtbarkeits-/Filter-Scopes für Demo-Logik (Freigaben, Dashboard, Anforderungen)
*/

import { MOCK } from "./mock-data.js";

const orgModel = (MOCK && MOCK.orgModel) ? MOCK.orgModel : { departments: [] };

const depts = (orgModel.departments || []).map(d => ({
  id: d.id,
  label: d.label,
  name: d.name,
  units: (d.units || []).map(u => ({ id: u.id, label: u.label, name: u.name }))
}));

const unitById = {};
depts.forEach(d => {
  d.units.forEach(u => {
    unitById[u.id] = { ...u, deptId: d.id, deptLabel: d.label, deptName: d.name };
  });
});

// Zusätzliche (nicht im Org-Model enthaltene) Einheiten für Demo
const EXTRA_UNITS = {
  ZB: { id:"ZB", label:"Zentrale Beschaffung", name:"Zentrale Beschaffung", deptId:"FB1", deptLabel:"Zentrale Steuerung", deptName:"Zentrale Steuerung" },
  IT: { id:"IT", label:"IT-Service", name:"IT-Service", deptId:"FB1", deptLabel:"Zentrale Steuerung", deptName:"Zentrale Steuerung" }
};

function initialsFromName(name){
  const parts = String(name||"").trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return "??";
  const a = parts[0][0] || "?";
  const b = parts.length > 1 ? (parts[parts.length-1][0] || "?") : (parts[0][1] || "?");
  return (a + b).toUpperCase();
}

function role(key, scopeType, scopeId){
  return { key, scopeType, scopeId };
}

// UI verwendet intern Status-Codes: online | meeting | away | reachable
// In den Mock-Daten kann "presence" deutsch sein (termin/abwesend/erreichbar).
function normalizeStatus(s){
  const v = String(s||"").toLowerCase();
  if(v === "online") return "online";
  if(v === "meeting" || v === "termin") return "meeting";
  if(v === "away" || v === "abwesend") return "away";
  if(v === "reachable" || v === "erreichbar") return "reachable";
  return "reachable";
}

// --- Fixe Rollen/Leitungen (gewünscht) ---
const mayor = {
  id: "p_mayor",
  name: "Oberbürgermeisterin Dr. Katharina Schwarz",
  initials: "OB",
  title: "Oberbürgermeisterin",
  isLeadership: true,
  unitId: null,
  employer: "city",
  presence: "online",
  roles: [ role("lead","org","org") ]
};

// Chef Zentrale Beschaffung (Nic)
const procurementChief = {
  id: "p_br",
  name: "Boris Dominic Rausch",
  initials: "BR",
  title: "Leitung Zentrale Beschaffung",
  isLeadership: true,
  unitId: "ZB",
  employer: "city",
  presence: "online",
  roles: [ role("user","unit","ZB"), role("central","org","org"), role("lead","org","org") ]
};

// 2 Admins in der ZB
const centralTeam = [
  procurementChief,
  {
    id:"p_vh",
    name:"Verena Hartmann",
    initials: initialsFromName("Verena Hartmann"),
    unitId:"ZB",
    employer:"city",
    presence:"erreichbar",
    roles:[ role("user","unit","ZB") ]
  },
  {
    id:"p_mk",
    name:"Mehmet Kaya",
    initials: initialsFromName("Mehmet Kaya"),
    unitId:"ZB",
    employer:"city",
    presence:"termin",
    roles:[ role("user","unit","ZB") ]
  }
];

// Fachbereich: zusätzliche Mitarbeitende (keine Leitung / keine Freigabe)
// Hinweis: Die Fachbereichsleitung wird unten deterministisch aus der Amtsleitung des jeweils ersten Amtes abgeleitet.
const deptLeads = {
  FB1: {
    id:"p_fb1",
    name:"Dr. Sandra Weber",
    initials: initialsFromName("Dr. Sandra Weber"),
    title: "Referat",
    unitId:"A12",
    employer:"city",
    presence:"termin",
    roles:[ role("user","unit","A12") ]
  },
  FB2: {
    id:"p_fb2",
    name:"Markus Hoffmann",
    initials: initialsFromName("Markus Hoffmann"),
    title: "Referat",
    unitId:"A22",
    employer:"city",
    presence:"erreichbar",
    roles:[ role("user","unit","A22") ]
  },
  FB3: {
    id:"p_fb3",
    name:"Julia Krüger",
    initials: initialsFromName("Julia Krüger"),
    title: "Referat",
    unitId:"A32",
    employer:"city",
    presence:"abwesend",
    roles:[ role("user","unit","A32") ]
  },
  FB4: {
    id:"p_fb4",
    name:"Thomas Neumann",
    initials: initialsFromName("Thomas Neumann"),
    title: "Referat",
    unitId:"A42",
    employer:"city",
    presence:"erreichbar",
    roles:[ role("user","unit","A42") ]
  }
};

// Amtsleitungen
const unitLeads = {
  A11: { id:"p_a11", name:"Dr. Lena Schmitt", initials: initialsFromName("Dr. Lena Schmitt"), unitId:"A11", employer:"city", presence:"erreichbar", roles:[ role("user","unit","A11") ] },
  A12: { id:"p_a12", name:"Kai Werner", initials: initialsFromName("Kai Werner"), unitId:"A12", employer:"city", presence:"termin", roles:[ role("user","unit","A12") ] },
  A13: { id:"p_a13", name:"Sabine Lorenz", initials: initialsFromName("Sabine Lorenz"), unitId:"A13", employer:"city", presence:"erreichbar", roles:[ role("user","unit","A13") ] },
  A21: { id:"p_a21", name:"Andreas Klein", initials: initialsFromName("Andreas Klein"), unitId:"A21", employer:"city", presence:"erreichbar", roles:[ role("user","unit","A21") ] },
  A22: { id:"p_a22", name:"Petra Vogel", initials: initialsFromName("Petra Vogel"), unitId:"A22", employer:"city", presence:"abwesend", roles:[ role("user","unit","A22") ] },
  A23: { id:"p_a23", name:"Ralf König", initials: initialsFromName("Ralf König"), unitId:"A23", employer:"city", presence:"erreichbar", roles:[ role("user","unit","A23") ] },
  A31: { id:"p_a31", name:"Nina Becker", initials: initialsFromName("Nina Becker"), unitId:"A31", employer:"city", presence:"erreichbar", roles:[ role("user","unit","A31") ] },
  A32: { id:"p_a32", name:"Sebastian Fuchs", initials: initialsFromName("Sebastian Fuchs"), unitId:"A32", employer:"city", presence:"termin", roles:[ role("user","unit","A32") ] },
  A33: { id:"p_a33", name:"Claudia Brandt", initials: initialsFromName("Claudia Brandt"), unitId:"A33", employer:"city", presence:"erreichbar", roles:[ role("user","unit","A33") ] },
  A41: { id:"p_a41", name:"Michael Hartmann", initials: initialsFromName("Michael Hartmann"), unitId:"A41", employer:"city", presence:"erreichbar", roles:[ role("user","unit","A41") ] },
  A42: { id:"p_a42", name:"Tanja Peters", initials: initialsFromName("Tanja Peters"), unitId:"A42", employer:"city", presence:"abwesend", roles:[ role("user","unit","A42") ] },
  A43: { id:"p_a43", name:"Florian Meier", initials: initialsFromName("Florian Meier"), unitId:"A43", employer:"city", presence:"erreichbar", roles:[ role("user","unit","A43") ] }
};

// Rollen/Leitung für Amtsleitungen ergänzen
Object.keys(unitLeads).forEach(unitId => {
  const p = unitLeads[unitId];
  p.title = "Amtsleitung";
  p.isLeadership = true;
  p.roles = [ role("user","unit",unitId), role("lead","unit",unitId) ];
});

// Fachbereichsleitung (Demo-Regel):
// Die Leitung eines Fachbereichs ist die Amtsleitung des jeweils ersten Amtes im Fachbereich (A11, A21, A31, A41).
// Dadurch bleibt die Freigabe-Logik stabil, auch wenn Organisation/People später ausgebaut werden.
const deptLeadByDeptId = {};
(depts || []).forEach(d => {
  const firstUnit = (d && Array.isArray(d.units) && d.units.length) ? d.units[0].id : null;
  if(!firstUnit) return;
  const p = unitLeads[firstUnit];
  if(!p) return;

  const extra = [ role("user","dept",d.id), role("lead","dept",d.id) ];
  const base = Array.isArray(p.roles) ? p.roles : [];
  const merged = [...extra];
  base.forEach(r => {
    const exists = merged.some(x => x.key === r.key && x.scopeType === r.scopeType && x.scopeId === r.scopeId);
    if(!exists) merged.push(r);
  });
  p.roles = merged;

  // In der Demo führt die Fachbereichsleitung gleichzeitig das erste Amt.
  p.title = "Fachbereichsleitung";
  p.isLeadership = true;

  deptLeadByDeptId[d.id] = p.id;
});

// IT-Service
const itLead = {
  id:"p_jn",
  name:"Jan Neumann",
  initials: initialsFromName("Jan Neumann"),
  unitId:"IT",
  employer:"city",
  presence:"erreichbar",
  roles:[ role("user","unit","IT") ]
};

// --- Restliche Mitarbeitende (deterministisch generiert) ---
const FIRST = ["Julia","Markus","Lara","David","Sophie","Ben","Eva","Tom","Paula","Nico","Miriam","Jonas","Lisa","Moritz","Hannah","Emil","Nora","Leon","Jana","Philipp","Marie","Noah","Mila","Finn","Luisa","Fabian"];
const LAST  = ["Schneider","Müller","Fischer","Weber","Klein","Braun","Zimmermann","Richter","Hartmann","Schmid","Bauer","Koch","Kruse","Wolf","Becker","Jansen","Hoffmann","König","Wagner","Neumann"];

const FIXED_NAMES = new Set([
  mayor.name,
  procurementChief.name,
  ...centralTeam.map(p=>p.name),
  ...Object.values(deptLeads).map(p=>p.name),
  ...Object.values(unitLeads).map(p=>p.name),
  itLead.name
]);

const allOrgUnitIds = depts.flatMap(d=> d.units.map(u=>u.id));
const targetEmployeesPerUnit = 4; // grob: 4 pro Amt
let seq = 1;

function presenceForIndex(i){
  if(i % 11 === 0) return "termin";
  if(i % 7 === 0) return "abwesend";
  if(i % 5 === 0) return "erreichbar";
  return "online";
}

const generated = [];
allOrgUnitIds.forEach((unitId, unitIdx) => {
  const existingFixed = [];
  // dept lead kann hier bereits drin sein
  Object.values(deptLeads).forEach(p => { if(p.unitId === unitId) existingFixed.push(p.id); });
  Object.values(unitLeads).forEach(p => { if(p.unitId === unitId) existingFixed.push(p.id); });

  const need = Math.max(0, targetEmployeesPerUnit - (existingFixed.length ? 1 : 0));
  for(let i=0;i<need;i++){
    // deterministische Namenskombi
    const fn = FIRST[(unitIdx*3 + i*2) % FIRST.length];
    const ln = LAST[(unitIdx*5 + i*3) % LAST.length];
    const nm = `${fn} ${ln}`;
    if(FIXED_NAMES.has(nm)) continue;
    FIXED_NAMES.add(nm);
    const pid = `p_${unitId.toLowerCase()}_${String(seq++).padStart(2,"0")}`;
    generated.push({
      id: pid,
      name: nm,
      initials: initialsFromName(nm),
      unitId,
      employer:"city",
      presence: presenceForIndex(seq),
      roles:[ role("user","unit",unitId) ]
    });
  }
});

// Personen-Liste zusammenbauen
const people = [
  mayor,
  procurementChief,
  ...centralTeam,
  ...Object.values(deptLeads),
  ...Object.values(unitLeads),
  itLead,
  ...generated
].map(p => {
  const u = (p.unitId && (unitById[p.unitId] || EXTRA_UNITS[p.unitId])) || null;
  return {
    ...p,
    // kompatibel zur Shell-UI (Personenverzeichnis / Persona-Auswahl)
    status: normalizeStatus(p.presence || p.status),
    deptId: u ? u.deptId : null,
    deptLabel: u ? u.deptLabel : null,
    unitLabel: u ? u.label : (p.unitId || null)
  };
});

const peopleById = Object.fromEntries(people.map(p => [p.id, p]));

// Leadership Mapping
const unitLeadByUnitId = {};
Object.keys(unitLeads).forEach(unitId => { unitLeadByUnitId[unitId] = unitLeads[unitId].id; });

export const PERSONNEL = {
  version: "0.18.6.2",
  depts,
  unitById: { ...unitById, ...EXTRA_UNITS },
  people,
  peopleById,
  leadership: {
    mayorId: mayor.id,
    procurementChiefId: procurementChief.id,
    deptLeadByDeptId,
    unitLeadByUnitId
  }
};
