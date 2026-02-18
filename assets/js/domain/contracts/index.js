/* social_order_v0.19.0 · domain/contracts/index (ESM)
   Aggregiert Rahmenverträge und leitet Demo-Sichten ab:
   - DEMO_SUPPLIERS (für MOCK.suppliers)
   - DEMO_CATALOG (für MOCK.catalog)
   - CONTRACTS_LEGACY (für UI-Kompatibilität)
*/

import { RV1 } from "./rv1_officepro.js";
import { RV2 } from "./rv2_printline.js";
import { RV3 } from "./rv3_meetingtools.js";

export const CONTRACTS_DOMAIN = [RV1, RV2, RV3];

// Legacy-Sicht: wie bisher in assets/js/contracts.js (Textbausteine)
export const CONTRACTS_LEGACY = Object.fromEntries(CONTRACTS_DOMAIN.map(c => [
  c.key,
  {
    title: c.title,
    scope: c.scope,
    delivery: c.delivery,
    shipTo: c.shipTo,
    packing: c.packing,
    invoice: c.invoice,
    notes: c.notes
  }
]));

// Demo-Sicht: wie bisher in MOCK.suppliers
export const DEMO_SUPPLIERS = CONTRACTS_DOMAIN.map(c => ({
  id: c.vendor.id,
  vendorId: c.vendor.id,
  name: c.vendor.name,
  contract: c.key,          // legacy
  contractKey: c.key,
  contractId: c.id,
  mbw: c.mbw,
  shippingFeeUnderMbw: c.shippingFeeUnderMbw
}));


// Demo-Sicht: wie bisher in MOCK.catalog
export const DEMO_CATALOG = CONTRACTS_DOMAIN.flatMap(c => (c.items || []).map(it => ({
  ...it,
  vendorId: c.vendor.id,
  vendor: c.vendor.name,
  contractId: c.id,
  contract: c.key,          // legacy
  contractKey: c.key
})));


// Helper
export function getContractByKey(key){
  return CONTRACTS_DOMAIN.find(c => c.key === key) || null;
}
