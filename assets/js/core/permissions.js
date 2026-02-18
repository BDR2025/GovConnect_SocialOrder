/*
  core/permissions.js
  - Role parsing + capability computation.
  - DOM role visibility helper for shell/app navigation.
*/

function getRoleList(user){
  const roles = (user && Array.isArray(user.roles)) ? user.roles : [];
  return roles.filter(r => r && typeof r === "object" && typeof r.key === "string");
}

function hasRoleKey(user, key){
  return getRoleList(user).some(r => r.key === key);
}

function findRole(user, key, scopeType, scopeId){
  return getRoleList(user).find(r =>
    r.key === key &&
    (!scopeType || r.scopeType === scopeType) &&
    (!scopeId || String(r.scopeId) === String(scopeId))
  ) || null;
}

export function createPermissionsApi({ state, ensureSession, getCurrentUser, getCurrentUserId }){
  function permissions(){
    ensureSession();
    const user = getCurrentUser();

    const leadOrg = findRole(user, "lead", "org");
    const leadDept = findRole(user, "lead", "dept");
    const leadUnit = findRole(user, "lead", "unit");
    let approverDept = findRole(user, "approver", "dept");

    // In dieser Demo übernimmt die Fachbereichsleitung die Freigabe (Gate-Fälle).
    // Falls keine explizite Approver-Rolle gepflegt ist, fällt die Freigabe auf lead/dep zurück.
    if(!approverDept && leadDept){
      approverDept = Object.assign({}, leadDept, { key: "approver" });
    }

    const isCentral = hasRoleKey(user, "central");

    const canBatch = Boolean(isCentral);
    // Freigaben sind ausschließlich für die (Fachbereichs-)Freigabe gedacht.
    // Leitung/Zentrale Beschaffung steuern über Dashboard, nicht über „Freigaben“.
    const canApprovals = Boolean(approverDept);
    const canDashboard = Boolean(leadOrg || leadDept || leadUnit || approverDept || isCentral);

    // Dashboard-Tabs: Freigabe bekommt nur "Steuerung" (now)
    const dashboardTabs = (approverDept && !leadOrg && !leadDept && !leadUnit && !isCentral)
      ? ["now"]
      : ["now","period","analysis"];

    // Scope fürs harte Filtern (ohne UI) bei Bereichs-/Amtsleitung
    let scope = { type: "org", deptId: "all", unitId: "all", locked: false };
    if(leadOrg || isCentral){
      scope = { type: "org", deptId: "all", unitId: "all", locked: false };
    } else if(leadDept){
      scope = { type: "dept", deptId: String(leadDept.scopeId), unitId: "all", locked: true };
    } else if(approverDept){
      scope = { type: "dept", deptId: String(approverDept.scopeId), unitId: "all", locked: true };
    } else if(leadUnit){
      scope = { type: "unit", deptId: "all", unitId: String(leadUnit.scopeId), locked: true };
    } else {
      const uUnit = (user && user.unitId) ? String(user.unitId) : "all";
      scope = { type: "self", deptId: "all", unitId: uUnit, locked: true };
    }

    // Scope für Freigaben
    let approvalsScope = { deptId: "none", unitId: "none" };
    if(leadOrg || isCentral){
      approvalsScope = { deptId: "all", unitId: "all" };
    } else if(approverDept){
      approvalsScope = { deptId: String(approverDept.scopeId), unitId: "all" };
    }

    const userId = getCurrentUserId();

    const roles = new Set(["user"]);
    if(isCentral) roles.add("central");
    if(approverDept) roles.add("approver");
    if(leadOrg || leadDept || leadUnit || isCentral) roles.add("lead");

    let roleLabel = "Mitarbeitende";
    if(isCentral) roleLabel = "Zentrale Beschaffung";
    else if(leadDept) roleLabel = "Fachbereichsleitung";
    else if(leadOrg || leadUnit) roleLabel = "Leitung";
    else if(approverDept) roleLabel = "Freigabe";

    return { user, userId, roles: Array.from(roles), roleLabel, leadOrg, leadDept, leadUnit, approverDept, isCentral, canBatch, canApprovals, canDashboard, scope, approvalsScope, dashboardTabs };
  }

  function canAccess(route){
    const caps = permissions();
    if(route.startsWith("/app/approvals")) return caps.canApprovals;
    if(route.startsWith("/app/batch")) return caps.canBatch;
    if(route.startsWith("/app/dashboard")) return caps.canDashboard;
    return true;
  }

  function applyRoleVisibility(){
    const caps = permissions();
    document.querySelectorAll("[data-role]").forEach(el=>{
      const need = el.getAttribute("data-role");
      let show = true;
      if(need === "approver") show = caps.canApprovals;
      if(need === "central") show = caps.canBatch;
      if(need === "lead") show = caps.canDashboard;
      el.style.display = show ? "" : "none";
    });
  }

  return { permissions, canAccess, applyRoleVisibility, findRole, hasRoleKey };
}

export { findRole, hasRoleKey };
