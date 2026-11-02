import type { Entity, Finding, State } from "./workflow.ts";

export type AlertTiming = { triggeredAt: string; triageDueAt: string; resolutionDueAt: string; level: "high" | "medium" | "low" };
export function createAlertTiming(triggeredAt: string, level: AlertTiming["level"]): AlertTiming {
  const [triageMinutes, resolutionMinutes] = { high: [5, 120], medium: [30, 480], low: [120, 1440] }[level];
  const start = Date.parse(triggeredAt);
  return { triggeredAt, level, triageDueAt: new Date(start + triageMinutes * 60000).toISOString(), resolutionDueAt: new Date(start + resolutionMinutes * 60000).toISOString() };
}
/** Backfill only from recorded trigger events; never restart a clock on refresh. */
export function withAlertDeadlines<T extends State>(state: T): T {
  let changed = false;
  const findings = state.findings.map(f => {
    if (f.source !== "auto" || f.alertTiming) return f;
    const trigger = state.logs.filter(l => l.target === f.id && l.action === "满足预警策略并生成预警" && Number.isFinite(Date.parse(l.at))).sort((a,b) => Date.parse(a.at) - Date.parse(b.at))[0];
    if (!trigger) return f;
    changed = true;
    return { ...f, alertTiming: createAlertTiming(trigger.at, f.severity) };
  });
  return changed ? { ...state, findings } : state;
}
export function alertFinished(f: Finding) { return f.status === "closed" || f.status === "delivered"; }
export function alertDeadlineLabel(f: Finding) { return f.status === "review" ? "预警处置截止" : "初审截止"; }
export function activeDeadline(e: Entity): string | undefined {
  if ("conclusions" in e && e.source === "auto") {
    if (!e.alertTiming || alertFinished(e)) return undefined;
    return e.status === "review" ? e.alertTiming.resolutionDueAt : e.alertTiming.triageDueAt;
  }
  return "dueAt" in e ? e.dueAt : undefined;
}
export function deadlineRemaining(dueAt: string, now: number) {
  const delta = Date.parse(dueAt) - now;
  const minutes = Math.max(1, Math.ceil(Math.abs(delta) / 60000));
  const duration = minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时${minutes % 60 ? ` ${minutes % 60} 分钟` : ""}`;
  return delta > 0 ? `剩余约 ${duration}` : `已逾期约 ${duration}`;
}
