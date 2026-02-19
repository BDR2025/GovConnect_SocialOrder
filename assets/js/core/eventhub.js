/* social_order_v0.20.3.0 · core/eventhub (ESM)
   Globaler Event-Hub für GovConnect: Prozess-Ereignisse (GcEvent) und Zeit-/Abwesenheitsblöcke (GcBlock).
   Persistiert nur Deltas; Baseline wird über domain/calendar generiert.
*/

import { generateBaselineBlocks } from "../domain/calendar.js";

function uid(prefix){
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function asIso(x){
  if(!x) return new Date().toISOString();
  if(typeof x === "string") return x;
  if(x instanceof Date) return x.toISOString();
  return new Date().toISOString();
}

function sameDedupeKey(a, b){
  return a && b && String(a) === String(b);
}

function intersects(startA, endA, startB, endB){
  const a0 = new Date(startA).getTime();
  const a1 = new Date(endA).getTime();
  const b0 = new Date(startB).getTime();
  const b1 = new Date(endB).getTime();
  if(Number.isNaN(a0) || Number.isNaN(a1) || Number.isNaN(b0) || Number.isNaN(b1)) return false;
  return a0 < b1 && b0 < a1;
}

function normalizeParticipants(p){
  const arr = Array.isArray(p) ? p : [];
  return Array.from(new Set(arr.filter(Boolean).map(String)));
}

function eventVisibleToUser(ev, userId){
  if(!ev || !userId) return false;
  if(ev.visibility && ev.visibility.mode === "public") return true;
  const parts = normalizeParticipants(ev.participants);
  return parts.includes(String(userId));
}

function blockVisibleToUser(blk, userId, isLeadOfOwner){
  if(!blk || !userId) return false;
  const me = String(userId);
  const owner = String(blk.ownerId || "");
  const mode = blk.visibility && blk.visibility.mode ? blk.visibility.mode : "owner";
  if(owner === me) return true;
  if(mode === "public") return true;
  if(mode === "owner") return false;
  if(mode === "ownerAndLeads") return !!isLeadOfOwner;
  return false;
}

export function createEventHub({ state, saveState, people, leadership, seed = "gc", soOrderVisibleToUser = null }){
  if(!state) throw new Error("eventhub: state missing");

  function ensureState(){
    if(!Array.isArray(state.gcEventsDelta)) state.gcEventsDelta = [];
    if(!Array.isArray(state.gcBlocksDelta)) state.gcBlocksDelta = [];
    if(!state.ui) state.ui = {};
    if(!state.ui.calendar) state.ui.calendar = {};
  }

  function persist(){
    try{ if(typeof saveState === "function") saveState(); }catch(_){/* ignore */}
  }

  function hasDeltaByDedupe(list, dedupeKey){
    if(!dedupeKey) return false;
    return list.some(x => x && sameDedupeKey(x.dedupeKey, dedupeKey));
  }

  function logEvent(input){
    ensureState();
    const ev = Object.assign({}, input || {});

    ev.id = ev.id || uid("ev");
    ev.ts = asIso(ev.ts);
    ev.participants = normalizeParticipants(ev.participants);
    ev.visibility = ev.visibility || { mode: "participants" };

    if(ev.dedupeKey && hasDeltaByDedupe(state.gcEventsDelta, ev.dedupeKey)) return ev;

    state.gcEventsDelta.unshift(ev);

    // small retention for deltas (keep newest 2000)
    if(state.gcEventsDelta.length > 2000) state.gcEventsDelta.length = 2000;
    persist();
    return ev;
  }

  function createBlock(input){
    ensureState();
    const blk = Object.assign({}, input || {});

    blk.id = blk.id || uid("blk");
    blk.start = asIso(blk.start);
    blk.end = asIso(blk.end);
    blk.visibility = blk.visibility || { mode: "owner" };

    if(blk.dedupeKey && hasDeltaByDedupe(state.gcBlocksDelta, blk.dedupeKey)) return blk;

    state.gcBlocksDelta.unshift(blk);

    // retention (keep newest 2000)
    if(state.gcBlocksDelta.length > 2000) state.gcBlocksDelta.length = 2000;
    persist();
    return blk;
  }

  function getPersonById(id){
    return (people || []).find(p => p && p.id === id) || null;
  }

  function isLeadOf(ownerId, leadId){
    // lead can see blocks of their dept scope
    const owner = getPersonById(ownerId);
    const lead = getPersonById(leadId);
    if(!owner || !lead) return false;

    // leadership mapping exists in personnel.js and is also used in permissions.
    const deptId = owner.deptId || owner.dept || owner.departmentId || null;
    const leadDeptId = lead.deptId || lead.dept || lead.departmentId || null;

    // if exact match on dept
    if(deptId && leadDeptId && deptId === leadDeptId) return true;

    // leadership may have explicit mapping: deptLeadByDeptId
    if(leadership && leadership.deptLeadByDeptId && deptId){
      const expected = leadership.deptLeadByDeptId[deptId];
      if(expected && String(expected) === String(leadId)) return true;
    }
    return false;
  }

  function getCalendarItems({ startIso, endIso, userId, view = "agenda", selectedUserId = null }){
    ensureState();

    const me = String(userId || "");
    const target = String(selectedUserId || me);
    const isLead = (target !== me) ? isLeadOf(target, me) : false;

    // Baseline blocks for target
    const baselineBlocks = generateBaselineBlocks({ startIso, endIso, ownerId: target, seed });

    // Deltas blocks
    const deltaBlocks = (state.gcBlocksDelta || [])
      .filter(b => b && b.ownerId && String(b.ownerId) === target)
      .filter(b => intersects(b.start, b.end, startIso, endIso));

    // Visibility filter for blocks
    const blocks = baselineBlocks
      .concat(deltaBlocks)
      .filter(b => blockVisibleToUser(b, me, isLead));

      // Events: only those that overlap time window by ts
    const canSeeSo = (typeof soOrderVisibleToUser === "function") ? soOrderVisibleToUser : null;

    const events = (state.gcEventsDelta || [])
      .filter(ev => ev && ev.ts)
      .filter(ev => {
        const t = new Date(ev.ts).getTime();
        return t >= new Date(startIso).getTime() && t < new Date(endIso).getTime();
      })
      .filter(ev => {
        const isSo = ev.subject && ev.subject.kind === "so" && ev.subject.id;

        // Social Order: Sichtbarkeit über Order-Scope (wie "Meine Anforderungen")
        if(isSo && canSeeSo){
          const ok = !!canSeeSo(ev.subject.id, me);
          if(!ok) return false;

          // Wenn ich andere Kalender anschaue: Verhalten bleibt minimalistisch
          // (zeigt SO-Events nur, wenn ich Leitung des Targets bin oder Target als Participant geführt wird).
          if(target === me) return true;
          if(isLead) return true;
          const parts = normalizeParticipants(ev.participants);
          return parts.includes(target);
        }

        // Default: participant/public
        if(target === me) return eventVisibleToUser(ev, me);
        if(!eventVisibleToUser(ev, me)) return false;
        const parts = normalizeParticipants(ev.participants);
        if(parts.includes(target)) return true;
        return !!isLead;
      });

    // Sort agenda
    events.sort((a,b)=> new Date(a.ts).getTime() - new Date(b.ts).getTime());
    blocks.sort((a,b)=> new Date(a.start).getTime() - new Date(b.start).getTime());

    return { blocks, events, targetUserId: target, isLeadView: isLead };
  }

  return {
    ensureState,
    logEvent,
    createBlock,
    getCalendarItems
  };
}
