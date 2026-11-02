import type { Finding, State } from './workflow.ts';

export function findingContext(state: State, finding: Finding) {
  const call = state.calls.find(item => item.id === finding.callId);
  const rule = state.rules.find(item => item.id === finding.ruleId);
  const captured = finding.basis;
  const basis = finding.detectionBasis;
  return { call, rule, captured, basis,
    summary: basis?.summary ?? (finding.source === 'manual' ? '人工登记的问题，具体发现依据待补充；请结合原话与复核意见核对。' : '系统已标记候选片段，但未保存具体触发说明；需结合命中规则和上下文核对。'),
  };
}
