/* social_order_v0.19.0 · Vertrags-/Rahmenvertragsdaten (Demo)
   Quelle: domain/contracts (Single Source of Truth)

   Zweck: Detailinfos für ZB im Bestelllauf (aufklappbar), ohne Logik in app.js aufzublähen.
*/

import {
  CONTRACTS_LEGACY,
  CONTRACTS_DOMAIN,
  DEMO_SUPPLIERS,
  DEMO_CATALOG,
  getContractByKey
} from "./domain/contracts/index.js";

// Legacy-Export für UI-Kompatibilität
export const CONTRACTS = CONTRACTS_LEGACY;

// Re-Exports für spätere Umstellung (optional)
export { CONTRACTS_DOMAIN, DEMO_SUPPLIERS, DEMO_CATALOG, getContractByKey };
