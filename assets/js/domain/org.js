/* social_order_v0.19.3 · domain/org (ESM)
   Organisationsmodell + Helper.

   Ziel:
   - Stammdaten (OrgModel) in einer strukturierten Form nutzbar machen.
   - Ableitungen zentralisieren (Units flat, Indizes, Kostenstellen, Locations).
   - Basis für Organigramm, People, Kalender‑Scopes.
*/

function safeModel(orgModel){
  const m = (orgModel && typeof orgModel === "object") ? orgModel : {};
  return {
    orgName: String(m.orgName || "Kreisstadt Exempla"),
    population: m.population ? String(m.population) : "",
    departments: Array.isArray(m.departments) ? m.departments : []
  };
}

export function buildOrgIndex(orgModel){
  const ORG_MODEL = safeModel(orgModel);

  const ORG_UNITS = [];
  const DEPT_BY_ID = {};

  for(const d of ORG_MODEL.departments){
    if(!d || !d.id) continue;
    const deptId = String(d.id);
    DEPT_BY_ID[deptId] = {
      id: deptId,
      name: String(d.name || deptId),
      label: String(d.label || d.name || deptId),
      units: Array.isArray(d.units) ? d.units : []
    };

    for(const u of (d.units || [])){
      if(!u || !u.id) continue;
      ORG_UNITS.push(Object.assign({}, u, {
        id: String(u.id),
        label: String(u.label || u.id),
        name: String(u.name || ""),
        deptId,
        deptName: String(d.name || deptId),
        deptLabel: String(d.label || d.name || deptId),
        costCenters: Array.isArray(u.costCenters) ? u.costCenters : [],
        locations: Array.isArray(u.locations) ? u.locations : []
      }));
    }
  }

  const ORG_BY_ID = Object.fromEntries(ORG_UNITS.map(u=> [String(u.id), u]));
  const ORG_BY_LABEL = Object.fromEntries(ORG_UNITS.map(u=> [String(u.label||"").trim(), u]));

  const COSTCENTER_BY_CODE = {};
  for(const u of ORG_UNITS){
    for(const cc of (u.costCenters || [])){
      if(!cc || !cc.code) continue;
      COSTCENTER_BY_CODE[String(cc.code)] = {
        code: String(cc.code),
        name: String(cc.name || ""),
        unitId: u.id,
        unitLabel: u.label,
        deptId: u.deptId,
        deptName: u.deptName
      };
    }
  }

  const ALL_LOCATIONS = Array.from(new Set(
    ORG_UNITS.flatMap(u => (u.locations || []).map(x => String(x)))
  ));

  return { ORG_MODEL, ORG_UNITS, ORG_BY_ID, ORG_BY_LABEL, COSTCENTER_BY_CODE, ALL_LOCATIONS, DEPT_BY_ID };
}

export function findDept(orgModel, deptId){
  const m = safeModel(orgModel);
  const id = String(deptId || "");
  return (m.departments || []).find(d => d && String(d.id) === id) || null;
}

export function findUnit(orgModel, unitId){
  const m = safeModel(orgModel);
  const id = String(unitId || "");
  for(const d of (m.departments || [])){
    for(const u of (d.units || [])){
      if(u && String(u.id) === id){
        return Object.assign({}, u, { deptId: String(d.id), deptName: String(d.name || d.id) });
      }
    }
  }
  return null;
}

export function unitsOfDept(orgModel, deptId){
  const d = findDept(orgModel, deptId);
  return d && Array.isArray(d.units) ? d.units : [];
}

export function costCentersOfUnit(orgModel, unitId){
  const u = findUnit(orgModel, unitId);
  return u && Array.isArray(u.costCenters) ? u.costCenters : [];
}

export function locationsOfUnit(orgModel, unitId){
  const u = findUnit(orgModel, unitId);
  return u && Array.isArray(u.locations) ? u.locations : [];
}
