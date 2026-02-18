/* social_order_v0.18.8 · domain/order (ESM)
   Pure order helpers (no DOM, no HTML rendering).
   Goal: keep app.js lean and make rules reusable across apps.
*/

export function orderTotal(order){
  const items = order && Array.isArray(order.items) ? order.items : [];
  return items.reduce((sum, it)=> sum + (Number(it.price) * Number(it.qty || 0)), 0);
}

export function orderItemCount(order){
  const items = order && Array.isArray(order.items) ? order.items : [];
  return items.reduce((sum, it)=> sum + Number(it.qty || 0), 0);
}

export function orderVendors(order){
  const items = order && Array.isArray(order.items) ? order.items : [];
  return Array.from(new Set(items.map(it => it.vendor).filter(Boolean)));
}

export function orderContracts(order){
  const items = order && Array.isArray(order.items) ? order.items : [];
  return Array.from(new Set(items.map(it => it.contract).filter(Boolean)));
}

export function orderVendor(order){
  const vs = orderVendors(order);
  return vs.length ? vs[0] : "–";
}

export function orderContract(order){
  const cs = orderContracts(order);
  return cs.length ? cs[0] : "";
}

// Short label for tables, e.g. "OfficePro + 2"
export function vendorsLabel(order){
  const vs = orderVendors(order);
  if(!vs.length) return "–";
  if(vs.length === 1) return vs[0];
  return `${vs[0]} + ${vs.length - 1}`;
}

export function vendorsFullLabel(order){
  const vs = orderVendors(order);
  return vs.length ? vs.join(", ") : "–";
}

export function contractsFullLabel(order){
  const cs = orderContracts(order);
  return cs.length ? cs.join(", ") : "";
}

export function splitParts(order){
  const p = order && (order.splits || order.subOrders || order.parts);
  return Array.isArray(p) ? p : [];
}

export function aggregateStatus(order){
  const parts = splitParts(order);
  if(!parts.length) return order ? order.status : undefined;
  const statuses = parts.map(p=>p && p.status).filter(Boolean);
  const uniq = Array.from(new Set(statuses));
  if(!uniq.length) return order ? order.status : undefined;
  if(uniq.length === 1) return uniq[0];
  if(uniq.includes("Abgeschlossen")) return "Teilweise abgeschlossen";
  if(uniq.includes("Bestellt")) return "Teilweise bestellt";
  if(uniq.includes("Im Bestelllauf")) return "Teilweise im Bestelllauf";
  return "In Bearbeitung";
}

export function syncAggregate(order){
  if(!order) return;
  if(splitParts(order).length){
    order.status = aggregateStatus(order);
  }
}

export function statusCategory(status){
  if(!status) return "open";
  if(String(status).startsWith("Teilweise")) return "open";
  if(status === "In Freigabe" || status === "Rückfrage") return "approval";
  if(status === "Abgeschlossen" || status === "Abgelehnt") return "done";
  return "open";
}

// Gate-Reason as plain text. Needs the current catalog (to detect "special" items).
export function orderGateReason(order, { gateThreshold = 25, catalog = [], catalogById = null } = {}){
  if(order && order.gateReason) return String(order.gateReason);

  const threshold = Number(gateThreshold);
  const total = orderTotal(order);

  let hasSpecial = false;
  const items = order && Array.isArray(order.items) ? order.items : [];

  if(catalogById && typeof catalogById === 'object'){
    for(const it of items){
      const c = it && it.id ? catalogById[it.id] : null;
      if(c && c.special){ hasSpecial = true; break; }
    }
  } else {
    const list = Array.isArray(catalog) ? catalog : [];
    for(const it of items){
      const id = it && it.id ? it.id : null;
      if(!id) continue;
      const c = list.find(x => x && x.id === id);
      if(c && c.special){ hasSpecial = true; break; }
    }
  }

  if(hasSpecial) return "Sonderbedarf";
  if(order && order.exceptionText) return "Sonderbedarf (Begründung)";
  if(Number.isFinite(threshold) && total >= threshold) return `Summe ≥ ${threshold} €`;
  if(order && order.urgency === "urgent") return "Dringlichkeit: dringend";
  return "Gate-Regel";
}
