import { withAlertDeadlines } from './alert-deadlines.ts';
import type { Log, State } from './workflow.ts';

const legacyFindings = new Set([
  ...Array.from({length:13}, (_, index) => `F-${1029 + index}`),
  'F-1039-B',
  ...Array.from({length:8}, (_, index) => `F-UI-${index + 1}`),
]);

/** Repair known legacy mock records using their saved detection times, never today's clock. */
export function withPrototypeAlertDeadlines<T extends State>(input:T):T {
  const state = withAlertDeadlines(input);
  const added:Log[] = [];
  for (const finding of state.findings) {
    if (finding.source !== 'auto' || finding.alertTiming || !legacyFindings.has(finding.id)) continue;
    const suffix = finding.id.slice(2).replace(/-B$/, '');
    if (finding.callId !== `CALL-${suffix}` || finding.batchId !== (suffix.startsWith('UI-') ? `B-${suffix}` : `B-${suffix}-1`)) continue;
    const call = state.calls.find(item => item.id === finding.callId);
    const batch = call?.batches.find(item => item.id === finding.batchId);
    if (!call || !batch) continue;
    const prior = state.logs.find(log => log.target === finding.id && log.action === '生成风险候选' && Number.isFinite(Date.parse(log.at)));
    const evidenceTimes = finding.evidence.map(index => call.transcript[index]?.at).filter((at):at is number => Number.isFinite(at));
    const trigger = prior ? Date.parse(prior.at) : batch.endedAt ? Date.parse(batch.endedAt)
      : !call.endedAt && evidenceTimes.length ? Date.parse(call.startedAt) + Math.max(...evidenceTimes) * 1000 : NaN;
    if (!Number.isFinite(trigger)) continue;
    const id = `EV-DEMO-TIMING-${finding.id}`;
    if (state.logs.some(log => log.id === id)) continue;
    added.push({id,target:finding.id,callId:call.id,at:new Date(trigger).toISOString(),actor:'system',action:'满足预警策略并生成预警',note:'检测命中预警条件，进入主管初审。'});
  }
  return added.length ? withAlertDeadlines({...state,logs:[...state.logs,...added].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))}) : state;
}
