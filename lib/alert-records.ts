import { canSee, latest, type Entity, type Finding, type State } from "./workflow.ts";

export const alertTabs = [["mine", "待处理"], ["review", "核实中"], ["delivered", "已分发"], ["closed", "误报归档"], ["all", "全部预警"]];
export function alertCategory(finding: Finding): string {
  if (latest(finding)?.value === "false_positive") return "closed";
  if (finding.status === "review") return "review";
  if (finding.status === "delivered") return "delivered";
  return "mine";
}
/** Follow issue IDs, never every event from the same call. Pre-split review events remain shared only through explicit historical targets. */
export function problemRecords(state: State, findingIds: string[]): Entity[] {
  const ids = new Set(findingIds);
  const records: Entity[] = [
    ...state.reviews.filter(item => item.findingIds.some(id => ids.has(id))),
    ...state.appeals.filter(item => ids.has(item.findingId)),
    ...state.remedies.filter(item => ids.has(item.findingId)),
  ];
  const targets = new Set([...ids, ...records.map(item => item.id)]);
  let pending = state.supplements.filter(item => targets.has(item.target));
  while (pending.length) {
    for (const item of pending) { records.push(item); targets.add(item.id); }
    pending = state.supplements.filter(item => targets.has(item.target) && !targets.has(item.id));
  }
  return records.filter(item => canSee(state, item.id));
}
export function problemLogs(state: State, findingIds: string[]) {
  const targets = new Set([...findingIds, ...problemRecords(state, findingIds).map(item => item.id)]);
  return state.logs.flatMap(log => {
    const target = [log.target, ...(log.relatedTargets ?? [])].find(id => targets.has(id) && canSee(state, id));
    return target ? [{ ...log, target }] : [];
  });
}
