/* social_order_v0.17.9 · core/utils (ESM)
   Kleine, wiederverwendbare Helper ohne DOM-Abhängigkeiten.
*/

export function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll("\"","&quot;")
    .replaceAll("'","&#39;");
}

export function eur(n){
  const val = Number(n);
  const safe = Number.isFinite(val) ? val : 0;
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(safe);
  } catch (e) {
    return safe.toFixed(2).replace('.', ',') + ' €';
  }
}

export function dt(ts){
  if(!ts) return '–';
  const d = (ts instanceof Date) ? ts : new Date(ts);
  if(Number.isNaN(d.getTime())) return '–';
  try {
    return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  } catch (e) {
    return d.toLocaleString();
  }
}
