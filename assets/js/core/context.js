/*
  core/context.js
  - Session / Persona helpers shared across the shell and apps.
  - Keeps app.js lean: app.js wires things together, context owns the session primitives.
*/

export function createSession({ state, people = [], leadership = {} }){
  function defaultUserId(){
    return (leadership && (leadership.procurementChiefId || leadership.mayorId)) || (people[0] ? people[0].id : null);
  }

  function ensureSession(){
    if(!state.session || typeof state.session !== "object") state.session = { userId: null };
    if(!state.session.userId) state.session.userId = defaultUserId();
  }

  function getCurrentUserId(){
    ensureSession();
    return state.session.userId;
  }

  // Backwards-compat helper (older code paths may call currentUserId()).
  function currentUserId(){
    return getCurrentUserId();
  }

  function getPersonById(id){
    return people.find(p => p && p.id === id) || null;
  }

  function getCurrentUser(){
    const u = getPersonById(getCurrentUserId());
    return u || (people[0] || null);
  }

  return {
    ensureSession,
    getCurrentUserId,
    currentUserId,
    getPersonById,
    getCurrentUser
  };
}
