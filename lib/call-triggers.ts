import { detection, type Call, type Finding } from "./workflow.ts";

/** Latest-batch automatic detections only. Callers supply findings visible to the viewer. */
export function callTriggers(call: Call, findings: Finding[]) {
  const batchId = call.batches.at(-1)?.id;
  const matches = batchId ? findings.filter(f=>f.callId===call.id).flatMap(f=>f.hits ? f.hits.filter(h=>h.batchId===batchId).map(h=>({ruleId:h.ruleId,indicator:h.basis?.resource.indicator??f.indicator})) : f.source==="auto"&&f.batchId===batchId?[f]:[]) : [];
  const complete = detection(call) === "已完成";
  const available = complete || matches.length > 0;
  return {
    ruleCount: available ? new Set(matches.map(f => f.ruleId)).size : null,
    indicatorCount: available ? new Set(matches.map(f => f.indicator)).size : null,
    complete,
  };
}
