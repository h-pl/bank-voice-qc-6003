import {upgradeUntouchedPolicyPresets} from "./policy-presets.ts";
import seed from "./initial-seed.json" with { type: "json" };
import { restoreLifecycle, type State } from "./workflow.ts";
import { reconcileAlerts } from "./call-alerts.ts";
export function shiftSeed(input: unknown, now: Date): State {
 const offset=now.getTime()-Date.parse("2026-10-31T00:00:00Z");
 const s=JSON.parse(JSON.stringify(input),(_key,value)=> typeof value==="string" && /^2026-\d\d-\d\dT.*Z$/.test(value) ? new Date(Date.parse(value)+offset).toISOString() : value) as State;
 return reconcileAlerts(restoreLifecycle(upgradeUntouchedPolicyPresets(s)),now,"载入业务记录");
}
export function createInitial(now=new Date()) {return shiftSeed(seed,now);}

export {indicatorRuleCategories as ruleCategories} from "./strategy-schema.ts";
