import type { Entity, State } from './workflow.ts';

// Stage deadlines share the recorded parent clock; unknown historical clocks stay unknown.
export function taskDeadlineLimit(state: State, item: Entity): string | undefined {
  if ('executor' in item) {
    const parent = [...state.reviews, ...state.appeals, ...state.remedies, ...state.findings].find(x => x.id === item.target);
    return parent ? taskDeadlineLimit(state, parent) : undefined;
  }
  const findings = 'conclusions' in item ? [item] : 'findingIds' in item && item.type !== 'appeal' ? state.findings.filter(f => item.findingIds.includes(f.id)) : [];
  const limits = findings.filter(f => f.source === 'auto' && f.alertTiming && !['closed', 'delivered'].includes(f.status)).map(f => {
    const t = f.alertTiming!;
    const reserve = (Date.parse(t.resolutionDueAt) - Date.parse(t.triggeredAt)) * .2;
    return Date.parse(t.resolutionDueAt) - reserve;
  });
  if ('findingIds' in item && item.appealId) {
    const appeal = state.appeals.find(a => a.id === item.appealId);
    if (appeal) limits.push(Date.parse(appeal.dueAt));
  }
  const finite = limits.filter(Number.isFinite);
  return finite.length ? new Date(Math.min(...finite)).toISOString() : undefined;
}
export function defaultTaskDeadline(state: State, item: Entity, action: string, now = Date.now()): string {
  const retained = retainedWarningDeadline(state, item, action, now);
  if (retained) return retained;
  if (action === 'adjust_distribution' && 'conclusions' in item && item.distribution) return item.distribution.dueAt;
  if (['reassign', 'extend'].includes(action) && 'dueAt' in item) return item.dueAt;
  if (['assign_appeal'].includes(action) && 'dueAt' in item) return new Date(Math.min(now+86400000,Date.parse(item.dueAt))).toISOString();
  const limit = taskDeadlineLimit(state, item);
  return new Date(Math.floor(Math.min(now + 86400000, limit ? Date.parse(limit) : Infinity) / 60000) * 60000).toISOString();
}

/** The warning workflow continues after expiry; retaining a deadline is not an extension. */
export function warningTask(state: State, item: Entity): boolean {
  if ('conclusions' in item) return item.source === 'auto' && !['closed', 'delivered'].includes(item.status);
  if ('findingIds' in item) return item.type !== 'appeal' && state.findings.some(f => item.findingIds.includes(f.id) && f.source === 'auto');
  if ('executor' in item) {
    const parent = [...state.reviews, ...state.findings].find(x => x.id === item.target);
    return !!parent && warningTask(state, parent);
  }
  return false;
}
export function retainedWarningDeadline(state: State, item: Entity, action: string, now: number): string | undefined {
  if (!['assign', 'remind', 'supplement', 'followup', 'return_review', 'reassign'].includes(action) || !warningTask(state, item)) return;
  const deadline = 'dueAt' in item ? item.dueAt : taskDeadlineLimit(state, item);
  return deadline && Date.parse(deadline) <= now ? deadline : undefined;
}
const warningSubmissionActions = new Set(['assign', 'remind', 'dismiss', 'dispatch', 'submit_review', 'publish', 'request_evidence', 'supplement', 'followup', 'return_review', 'reply', 'receive_supplement', 'reassign']);
export function warningSubmissionDeadline(state: State, item: Entity, action: string): {at:string; label:string} | undefined {
  if (!warningSubmissionActions.has(action) || !warningTask(state, item)) return;
  if ('conclusions' in item) {
    const timing = item.alertTiming;
    if (!timing) return;
    return {at: item.status === 'review' ? timing.resolutionDueAt : timing.triageDueAt,
      label: item.status === 'review' ? '预警处置截止' : '初审截止'};
  }
  if ('dueAt' in item && !('pause' in item && item.pause)) return {at:item.dueAt, label:'办理截止'};
}
export function lateWarningSubmission(state: State, item: Entity, action: string, now: number) {
  const deadline = warningSubmissionDeadline(state, item, action);
  if (!deadline || !Number.isFinite(Date.parse(deadline.at)) || now <= Date.parse(deadline.at)) return;
  return {...deadline, exceededByMs:now - Date.parse(deadline.at)};
}
