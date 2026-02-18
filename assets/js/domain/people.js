/* social_order_v0.19.2 · domain/people (ESM)
   People directory model (separate from Persona/Login roles).

   Ziel:
   - Aus einer Personenliste (z. B. aus personnel.js) ein stabiles Verzeichnis erzeugen.
   - Einheit/Fachbereich sauber ableiten.
   - Kontaktfelder als Mock ergänzen (E-Mail, Telefon, Dienstort).
   - Später wiederverwendbar für Organisation + Kalender.
*/

function deptLabelFromId(deptId){
  const m = String(deptId || "").match(/^FB(\d+)$/i);
  return m ? `Fachbereich ${m[1]}` : (deptId ? String(deptId) : "—");
}

function normalizeUmlauts(s){
  return String(s || "")
    .replaceAll("ä","ae").replaceAll("ö","oe").replaceAll("ü","ue")
    .replaceAll("Ä","Ae").replaceAll("Ö","Oe").replaceAll("Ü","Ue")
    .replaceAll("ß","ss");
}

function slugifyName(name){
  const clean = normalizeUmlauts(name).toLowerCase();
  const parts = clean.split(/[^a-z0-9]+/).filter(Boolean);
  if(!parts.length) return "user";
  return parts.join(".");
}

function hashToNumber(str){
  const s = String(str || "");
  let h = 0;
  for(let i = 0; i < s.length; i++){
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function flattenOrgUnits(orgModel){
  const out = [];
  const deps = (orgModel && Array.isArray(orgModel.departments)) ? orgModel.departments : [];
  for(const d of deps){
    const units = Array.isArray(d.units) ? d.units : [];
    for(const u of units){
      out.push(Object.assign({}, u, {
        deptId: d.id,
        deptName: d.name,
        deptLabel: deptLabelFromId(d.id)
      }));
    }
  }
  return out;
}

export function unitIndex(orgModel, extraUnits = {}){
  const idx = {};
  const units = flattenOrgUnits(orgModel);
  units.forEach(u => { idx[String(u.id)] = u; });

  const extras = extraUnits && typeof extraUnits === "object" ? extraUnits : {};
  Object.keys(extras).forEach(k => {
    const u = extras[k];
    if(!u || !u.id) return;
    idx[String(u.id)] = Object.assign({}, u, {
      deptLabel: u.deptLabel || deptLabelFromId(u.deptId)
    });
  });
  return idx;
}

export function buildPeopleDirectory({
  people = [],
  orgModel = null,
  extraUnits = null,
  emailDomain = "exempla.local",
  phonePrefix = "0681 100-"
} = {}){
  const extras = extraUnits || {
    ZB: { id:"ZB", label:"Zentrale Beschaffung", name:"Zentrale Beschaffung", deptId:"FB1", deptLabel:"Zentrale Steuerung" },
    IT: { id:"IT", label:"IT‑Service", name:"IT‑Service", deptId:"FB1", deptLabel:"Zentrale Steuerung" }
  };

  const uIdx = unitIndex(orgModel, extras);

  return (Array.isArray(people) ? people : [])
    .filter(Boolean)
    .map(p => {
      const id = String(p.id || "");
      const name = String(p.name || "—");
      const unitId = p.unitId ? String(p.unitId) : "";
      const u = unitId ? (uIdx[unitId] || null) : null;

      const deptId = u ? String(u.deptId) : (p.deptId ? String(p.deptId) : "");
      const deptLabel = u
        ? String(u.deptLabel || deptLabelFromId(u.deptId))
        : (p.deptLabel ? String(p.deptLabel) : (deptId ? deptLabelFromId(deptId) : "—"));

      const unitLabel = u
        ? String(u.label || u.id)
        : (p.unitLabel ? String(p.unitLabel) : (unitId || "—"));

      const unitName = u ? String(u.name || "") : "";

      const emailUser = slugifyName(name);
      const email = `${emailUser}@${emailDomain}`;
      const phoneExt = String(hashToNumber(id)).slice(-4).padStart(4, "0");
      const phone = `${phonePrefix}${phoneExt}`;

      const office = (u && Array.isArray(u.locations) && u.locations.length)
        ? String(u.locations[0])
        : "—";

      return {
        id,
        name,
        initials: String(p.initials || ""),
        title: String(p.title || ""),
        isLeadership: !!p.isLeadership,
        presence: String(p.presence || p.status || ""),
        deptId: deptId || null,
        deptLabel,
        unitId: unitId || null,
        unitLabel,
        unitName,
        email,
        phone,
        office
      };
    });
}

export function findPerson(peopleDir, id){
  const pid = String(id || "");
  return (Array.isArray(peopleDir) ? peopleDir : []).find(p => p && String(p.id) === pid) || null;
}

export function presenceBadge(presence){
  const st = String(presence || "").toLowerCase();
  if(st === "online") return { dot: "dot dot--green", label: "Online" };
  if(st === "meeting" || st === "termin") return { dot: "dot dot--blue", label: "Im Termin" };
  if(st === "reachable" || st === "erreichbar") return { dot: "dot dot--violet", label: "Erreichbar" };
  return { dot: "dot", label: "Abwesend" };
}
