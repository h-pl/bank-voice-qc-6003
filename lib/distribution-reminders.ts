import { canSee, roleOf, callFor, type State, type Log } from './workflow.ts';
import { currentTaskContext, taskIsOverdue } from './case-context.ts';
export function distributionReminders(state: State, now: number): Log[] {
  if (!['supervisor', 'agent'].includes(roleOf(state))) return [];
  return state.findings.flatMap(f => {
    const d = f.distribution;
    const task = currentTaskContext(state, f);
    if (!canSee(state,f.id) || d?.status !== 'pending' || !task.dueAt || task.paused) return [];
    const due = Date.parse(task.dueAt), start = Date.parse(d.at);
    const threshold = start + (due - start) * .8;
    if (!Number.isFinite(due) || now < threshold) return [];
    const overdue = taskIsOverdue(state, f, now);
    return [{id:`response-${f.id}-${d.sequence}-${d.responseDueAt}-${overdue ? 'overdue' : 'near'}`,target:f.id,callId:callFor(state,f.id)?.id,at:new Date(overdue ? due : threshold).toISOString(),actor:'S01',action:overdue ? '坐席回应已逾期' : '坐席回应即将到期',note:`${f.title}：请坐席接受整改或提出申诉。${overdue ? '责任主管需跟进未回应事项；' : ''}回应截止 ${new Date(due).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}；不会自动接受或重置整改期限。`}];
  });
}
