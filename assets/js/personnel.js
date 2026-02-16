/*
  Social Order – Personal & Rollen (Mock)
  v0.16

  Ziel:
  - Eine zentrale, leicht administrierbare Quelle für Personen, Zuordnung (Amt/Fachbereich)
  - Rollen + Sichtbarkeits-/Filter-Scopes für Demo-Logik (Freigaben, Dashboard, Anforderungen)
*/

(function(){
  const root = (window.SOCIAL_ORDER = window.SOCIAL_ORDER || {});
  const mock = root.mock || {};
  const orgModel = mock.orgModel || { departments: [] };

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
    const v = String(s||""
    ).toLowerCase();
    if(v === "online") return "online";
    if(v === "meeting" || v === "termin") return "meeting";
    if(v === "away" || v === "abwesend") return "away";
    if(v === "reachable" || v === "erreichbar") return "reachable";
    return "reachable";
  }

  // --- Fixe Rollen/Leitungen (gewünscht) ---
  const mayor = {
    id: "p_mayor",
    name: "Bürgermeisterin Dr. Katharina Schwarz",
    initials: "BM",
    title: "Bürgermeisterin",
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

  // Team Zentrale Beschaffung (sichtbar im Personen-Screen)
  const centralTeam = [
    { id:"p_tb", name:"Tim Becker", unitId:"ZB", presence:"online" },
    { id:"p_fw", name:"Felix Wolf", unitId:"ZB", presence:"termin" },
    { id:"p_tj", name:"Tobias Jansen", unitId:"ZB", presence:"online" },
    { id:"p_kw", name:"Kevin Wagner", unitId:"ZB", presence:"erreichbar" }
  ].map(p => ({
    ...p,
    initials: initialsFromName(p.name),
    employer: "city",
    roles: [ role("user","unit","ZB"), role("central","org","org"), role("lead","org","org") ]
  }));

  // Fachbereichsleitungen (je 3 Ämter) – wir nehmen bewusst bekannte Namen aus den Screens.
  // Sie sind zugleich Amtsleitungen ihres Heim-Amts.
  const deptLeads = {
    FB1: {
      id:"p_ak",
      name:"Anna Krüger",
      unitId:"A11",
      presence:"online",
      roles: [ role("user","unit","A11"), role("lead","unit","A11"), role("lead","dept","FB1"), role("approver","dept","FB1") ]
    },
    FB2: {
      id:"p_ms",
      name:"Max Sommer",
      unitId:"A21",
      presence:"termin",
      roles: [ role("user","unit","A21"), role("lead","unit","A21"), role("lead","dept","FB2"), role("approver","dept","FB2") ]
    },
    FB3: {
      id:"p_lh",
      name:"Lea Hoffmann",
      unitId:"A31",
      presence:"abwesend",
      roles: [ role("user","unit","A31"), role("lead","unit","A31"), role("lead","dept","FB3"), role("approver","dept","FB3") ]
    },
    FB4: {
      id:"p_sk",
      name:"Sara König",
      unitId:"A41",
      presence:"abwesend",
      roles: [ role("user","unit","A41"), role("lead","unit","A41"), role("lead","dept","FB4"), role("approver","dept","FB4") ]
    }
  };

  Object.values(deptLeads).forEach(p => { p.initials = initialsFromName(p.name); p.employer = "city"; p.title = "Fachbereichsleitung"; p.isLeadership = true; });

  // Amtsleitungen für die restlichen Ämter
  const unitLeads = {
    A12: { id:"p_np", name:"Nina Peters", presence:"online" },
    A13: { id:"p_dw", name:"Daniel Weber", presence:"online" },
    A22: { id:"p_mw", name:"Max Wagner", presence:"erreichbar" },
    A23: { id:"p_fr", name:"Franziska Richter", presence:"online" },
    A32: { id:"p_lha", name:"Lea Hartmann", presence:"termin" },
    A33: { id:"p_ob", name:"Oskar Brandt", presence:"online" },
    A42: { id:"p_cn", name:"Clara Neumann", presence:"online" },
    A43: { id:"p_ps", name:"Paul Schneider", presence:"online" }
  };

  Object.keys(unitLeads).forEach(unitId => {
    const p = unitLeads[unitId];
    p.unitId = unitId;
    p.initials = initialsFromName(p.name);
    p.employer = "city";
    p.title = "Amtsleitung";
    p.isLeadership = true;
    p.roles = [ role("user","unit",unitId), role("lead","unit",unitId) ];
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
  const generated = [];
  let seq = 1;

  function presenceForIndex(i){
    if(i % 11 === 0) return "termin";
    if(i % 7 === 0) return "abwesend";
    if(i % 5 === 0) return "erreichbar";
    return "online";
  }

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
  Object.values(deptLeads).forEach(p => { if(p.unitId) unitLeadByUnitId[p.unitId] = p.id; });
  Object.keys(unitLeads).forEach(unitId => { unitLeadByUnitId[unitId] = unitLeads[unitId].id; });

  const deptLeadByDeptId = {
    FB1: deptLeads.FB1.id,
    FB2: deptLeads.FB2.id,
    FB3: deptLeads.FB3.id,
    FB4: deptLeads.FB4.id
  };

  root.personnel = {
    version: "0.16.7",
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
})();
