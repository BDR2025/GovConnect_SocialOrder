/* social_order_v0.19.0 · domain/gate (ESM)
   Zentrale Gate-Entscheidung für Social Order.
   Ziel: keine verteilten Gate-Ifs mehr in UI-Views.

   Hinweise:
   - "special" an Artikeln gilt als Sonderbedarf-Signal (legacy).
   - Optional: gatePolicy kann später pro Artikel gesteuert werden:
     - "always_gate" → immer Gate
     - "bypass_gate" → nie Gate (ignoriert Schwelle/Dringlichkeit)
*/

function isTruthySpecial(it){
  return Boolean(
    it && (
      it.special === true ||
      it.isSonderbedarf === true ||
      it.gatePolicy === "always_gate"
    )
  );
}

function isBypassGate(it){
  return Boolean(it && it.gatePolicy === "bypass_gate");
}

export function computeGate({ items, exceptionText, urgency, threshold }){
  const list = Array.isArray(items) ? items : [];
  const t = Number.isFinite(Number(threshold)) ? Number(threshold) : 25;

  const total = list.reduce((sum, it) => {
    const qty = Number(it && it.qty) || 0;
    const price = Number(it && it.price) || 0;
    return sum + (qty * price);
  }, 0);

  const hasSpecial = list.some(isTruthySpecial);

  // Wenn ALLE Positionen explizit "bypass_gate" sind, wird Gate unterdrückt.
  const allBypass = list.length > 0 && list.every(isBypassGate);

  const ex = String(exceptionText || "").trim();
  const missingJustification = hasSpecial && ex.length === 0;

  const reasons = [];

  // Sonderbedarf
  // Begründung wird separat über missingJustification geprüft.
  if(hasSpecial) reasons.push("Sonderbedarf");

  // Schwelle
  if(!allBypass && total >= t) reasons.push(`Summe ≥ ${t} €`);

  // Dringlichkeit
  if(!allBypass && String(urgency || "") === "urgent") reasons.push("Dringlichkeit: dringend");

  const needsGate = reasons.length > 0 && !allBypass;
  const status = needsGate ? "In Freigabe" : "Freigegeben";
  const gateReason = needsGate ? reasons.join(" · ") : "";

  return {
    total,
    threshold: t,
    hasSpecial,
    allBypass,
    exceptionText: ex,
    missingJustification,
    reasons,
    needsGate,
    status,
    gateReason
  };
}
