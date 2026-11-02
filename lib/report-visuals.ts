import { localDate, type Metric, type ReportFilter, type Row } from './reports.ts';
import { latest, people, type State } from './workflow.ts';
import { officialIndicators } from './official-indicators.ts';
import { supportsWarning } from './strategy-schema.ts';

export type TrendPoint = { start: string; end: string; label: string; value: number | null; count: number; denominator?: number };
export type VisualGroup = { key: string; label: string; rows: Row[] };
const findingVerdict = (f: State['findings'][number]) => latest(f)?.value === 'false_positive' && f.source === 'manual' ? 'manual_revoked' : latest(f)?.value ?? 'pending';
const dayMs = 86400000;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);
const isoDay = (stamp: number) => new Date(stamp).toISOString().slice(0, 10);
export function periodRows(rows: Row[], start: string, end: string) {
  return rows.filter(r => r.date && localDate(r.date) >= start && localDate(r.date) <= end);
}
export function periodMetric(s: State, metrics: Metric[], key: string, period: Pick<TrendPoint, 'start' | 'end'>): Metric | undefined {
  const metric = metrics.find(m => m.key === key);
  if (!metric) return;
  const rows = periodRows(metric.rows, period.start, period.end);
  const completed = new Set(metrics.find(m => m.key === 'completed')?.rows.map(r => r.id));
  const findings = new Map(s.findings.map(f => [f.id, f]));
  const n = key === 'coverage' ? rows.filter(r => completed.has(r.id)).length : key === 'fp' ? rows.filter(r => {const f = findings.get(r.id);return f && latest(f)?.value === 'false_positive';}).length : rows.length;
  const ratio = key === 'coverage' || key === 'fp';
  const scope = `${period.start}${period.end === period.start ? '' : ` 至 ${period.end}`}`;
  const basis = key === 'coverage' ? `已完成 ${n} / 已结束通话 ${rows.length}` : key === 'fp' ? `自动候选中误报 ${n} /（误报 + 成立）${rows.length}；不是模型 FPR` : key === 'risk' ? '按通话结束日期；当前有效成立结论' : '按通话结束日期；不含通话中记录';
  return {...metric, key:`${key}-${period.start}`, label:`${metric.label} · ${scope}`, rows, value:ratio ? rows.length ? `${(n / rows.length * 100).toFixed(1)}%` : '—' : String(n), note:`所选日期 ${scope}；${basis}`} ;
}
export function reportTrend(s: State, metrics: Metric[], key: string, filter: ReportFilter, today: string) {
  const byKey = new Map(metrics.map(m => [m.key, m]));
  const source = byKey.get(key)?.rows ?? [];
  const days = (byKey.get('calls')?.rows ?? []).map(r => localDate(r.date)).sort();
  const start = filter.start || days[0] || today, end = filter.end || days.at(-1) || today;
  const count = Math.floor((utc(end) - utc(start)) / dayMs) + 1;
  if (!Number.isFinite(count) || count < 1) return { points: [] as TrendPoint[], stride: 1 };
  const stride = Math.max(1, Math.ceil(count / 31));
  const completed = new Set(byKey.get('completed')?.rows.map(r => r.id));
  const findings = new Map(s.findings.map(f => [f.id, f]));
  const points: TrendPoint[] = [];
  for (let i = 0; i < count; i += stride) {
    const a = isoDay(utc(start) + i * dayMs), b = isoDay(utc(start) + Math.min(count - 1, i + stride - 1) * dayMs);
    const rows = periodRows(source, a, b), denominator = rows.length;
    const numerator = key === 'coverage' ? rows.filter(r => completed.has(r.id)).length
      : key === 'fp' ? rows.filter(r => { const f = findings.get(r.id); return f && latest(f)?.value === 'false_positive'; }).length : rows.length;
    const ratio = key === 'coverage' || key === 'fp';
    points.push({ start: a, end: b, label: a.slice(5).replace('-', '/'), count: numerator,
      ...(ratio ? { denominator } : {}), value: a > today ? null : ratio ? denominator ? numerator / denominator * 100 : null : numerator });
  }
  return { points, stride };
}
export function reportVisuals(s: State, metrics: Metric[], filter: ReportFilter) {
  const byKey = new Map(metrics.map(m => [m.key, m]));
  const callRows = byKey.get('calls')?.rows ?? [], callIds = new Set(callRows.map(r => r.id));
  const callById = new Map(s.calls.map(c => [c.id, c]));
  const findingById = new Map(s.findings.map(f => [f.id, f]));
  const risk = byKey.get('risk')?.rows ?? [];
  const indicators: VisualGroup[] = officialIndicators.filter(i => s.rules.some(r => r.indicator === i.id)).map(i => ({ key: i.id, label: i.name, rows: risk.filter(r => findingById.get(r.id)?.indicator === i.id) }));
  const verdictNames = { risk: '风险成立', false_positive: '自动误报', manual_revoked: '人工问题已撤销', insufficient: '证据不足', pending: '尚未判定' };
  const allFindings: Row[] = s.findings.filter(f => callIds.has(f.callId)).map(f => ({ id: f.id, callId: f.callId, title: f.title, status: verdictNames[findingVerdict(f)], date: callById.get(f.callId)!.endedAt! }));
  const verdicts: VisualGroup[] = Object.entries(verdictNames).map(([key, label]) => ({ key, label, rows: allFindings.filter(r => findingVerdict(findingById.get(r.id)!) === key) }));
  const teams = people.filter(p => p.role === 'agent' && (!filter.agent || p.id === filter.agent) && (!filter.group || s.calls.some(c => c.agentId === p.id && c.group === filter.group))).map(p => {
    const calls = callRows.filter(r => callById.get(r.id)?.agentId === p.id), ids = new Set(calls.map(r => r.id));
    const findings = allFindings.filter(r => ids.has(r.callId));
    return { id: p.id, name: p.name, group: s.calls.find(c => c.agentId === p.id)?.group ?? '', calls,
      known: findings.filter(r => !!latest(findingById.get(r.id)!)), risk: risk.filter(r => ids.has(r.callId)),
      fp: findings.filter(r => findingVerdict(findingById.get(r.id)!) === 'false_positive'),
      manualRevoked: findings.filter(r => findingVerdict(findingById.get(r.id)!) === 'manual_revoked'),
      insufficient: findings.filter(r => latest(findingById.get(r.id)!)?.value === 'insufficient'),
      activeRemedies: s.remedies.filter(r => ids.has(findingById.get(r.findingId)?.callId ?? '') && !['done', 'terminated'].includes(r.status)).length,
      indicators: indicators.map(i => ({ ...i, rows: i.rows.filter(r => ids.has(r.callId)) })) };
  });
  return { indicators, verdicts, teams, allFindings, callById };
}
export function visualMetric(key: string, label: string, rows: Row[], note: string): Metric {
  return { key, label, rows, note, value: String(rows.length) };
}


export type IssueMetricKey = 'candidates' | 'risk' | 'manual' | 'fp';
// Cards, both charts and drill-downs share the same filtered warning population.
export function issueReportVisuals(s: State, metrics: Metric[], key: IssueMetricKey) {
  const findingById = new Map(s.findings.map(f => [f.id, f]));
  const keys: IssueMetricKey[] = ['candidates', 'risk', 'manual', 'fp'];
  const summaries = keys.flatMap(metricKey => {
    const source = metrics.find(m => m.key === metricKey);
    if (!source) return [];
    const rows = source.rows.filter(row => {
      const finding = findingById.get(row.id);
      return finding && supportsWarning(finding.indicator);
    });
    const falsePositives = rows.filter(row => latest(findingById.get(row.id)!)?.value === 'false_positive').length;
    return [{ ...source, rows,
      value: metricKey === 'fp' ? rows.length ? `${(falsePositives / rows.length * 100).toFixed(1)}%` : '—' : String(rows.length),
      note: metricKey === 'fp' ? `自动预警中误报 ${falsePositives} /（误报 + 成立）${rows.length}；仅预警指标，不含未判定、证据不足及人工发现` : `${source.note}；仅统计支持预警的指标`,
    }];
  });
  const metric = summaries.find(m => m.key === key);
  const rows = metric?.rows ?? [];
  const indicators: VisualGroup[] = officialIndicators.filter(i => supportsWarning(i.id) &&
    (s.rules.some(rule => rule.indicator === i.id) || rows.some(row => findingById.get(row.id)?.indicator === i.id)))
    .map(i => ({ key: i.id, label: i.name, rows: rows.filter(row => findingById.get(row.id)?.indicator === i.id) }));
  const verdictNames = { risk: '风险成立', false_positive: '自动误报', manual_revoked: '人工问题已撤销', insufficient: '证据不足', pending: '尚未判定' };
  const verdicts: VisualGroup[] = Object.entries(verdictNames).map(([value, label]) => ({ key: value, label,
    rows: rows.filter(row => findingVerdict(findingById.get(row.id)!) === value),
  }));
  const titles: Record<IssueMetricKey, string> = {
    candidates: '自动预警 · 指标分布', risk: '成立问题 · 预警指标分布',
    manual: '人工发现 · 预警指标分布', fp: '误报判定样本 · 预警指标分布',
  };
  return { summaries, metric, indicators, verdicts, total: rows.length, title: titles[key],
    note: key === 'fp' ? '自动预警中已确认成立或误报的问题；按主指标计数' : '仅预警指标；按主指标计数',
  };
}


export type TeamMetricKey = 'calls' | 'completed' | 'riskcalls' | 'risk';
export function teamReportVisuals(s: State, metrics: Metric[], filter: ReportFilter, key: TeamMetricKey) {
  const byKey = new Map(metrics.map(m => [m.key, m]));
  const callById = new Map(s.calls.map(c => [c.id, c]));
  const riskMetric = issueReportVisuals(s, metrics, 'risk').metric;
  const riskRows = riskMetric?.rows ?? [];
  const completed = byKey.get('completed')?.rows ?? [];
  const riskCallIds = new Set(riskRows.map(row => row.callId));
  const riskCalls = completed.filter(row => riskCallIds.has(row.id));
  const ratio = (n: number, d: number) => d ? `${(n / d * 100).toFixed(1)}%` : '—';
  const riskCallSource = byKey.get('riskcalls');
  const riskCallMetric = riskCallSource ? {...riskCallSource, rows:riskCalls, value:ratio(riskCalls.length, completed.length),
    note:`自动检测完成通话中确认风险 ${riskCalls.length} / 已完成 ${completed.length}；仅预警指标，按通话去重`} : undefined;
  const summaries = [byKey.get('calls'), byKey.get('completed'), riskCallMetric, riskMetric].filter((m): m is Metric => !!m);
  const metric = summaries.find(m => m.key === key);
  const rows = metric?.rows ?? [];
  const callIds = new Set(rows.map(row => row.callId));
  const riskIds = new Set(riskRows.map(row => row.id));
  const findings = s.findings.filter(f => callIds.has(f.callId) && supportsWarning(f.indicator) &&
    (!['risk', 'riskcalls'].includes(key) || riskIds.has(f.id)));
  const indicators = officialIndicators.filter(i => supportsWarning(i.id) &&
    (s.rules.some(rule => rule.indicator === i.id) || findings.some(f => f.indicator === i.id)));
  const unit = key === 'risk' ? '条' : '通';
  const matrixNote = key === 'risk' ? '确认问题按主指标计数，仅显示预警指标' :
    `${key === 'riskcalls' ? '确认风险' : '所选通话中的问题'}按主指标归属；每格按通话去重，同一通话可涉及多个指标`;
  const agents = people.filter(p => p.role === 'agent' && (!filter.agent || p.id === filter.agent) &&
    (!filter.group || s.calls.some(c => c.agentId === p.id && c.group === filter.group))).map(p => {
    const selectedRows = rows.filter(row => callById.get(row.callId)?.agentId === p.id);
    const agentCallIds = new Set(selectedRows.map(row => row.callId));
    const agentFindings = findings.filter(f => agentCallIds.has(f.callId));
    const denominator = completed.filter(row => callById.get(row.id)?.agentId === p.id).length;
    return {id:p.id, name:p.name, group:s.calls.find(c => c.agentId === p.id && (!filter.group || c.group === filter.group))?.group ?? '',
      rows:selectedRows, denominator, value:key === 'riskcalls' ? ratio(selectedRows.length,denominator) : String(selectedRows.length),
      callCount:agentCallIds.size, findingCount:agentFindings.length,
      risk:agentFindings.filter(f => latest(f)?.value === 'risk').length,
      fp:agentFindings.filter(f => f.source === 'auto' && latest(f)?.value === 'false_positive').length,
      manualRevoked:agentFindings.filter(f => f.source === 'manual' && latest(f)?.value === 'false_positive').length,
      insufficient:agentFindings.filter(f => latest(f)?.value === 'insufficient').length,
      indicators:indicators.map(i => {
        const matches=agentFindings.filter(f => f.indicator === i.id), ids=new Set(matches.map(f=>key === 'risk' ? f.id : f.callId));
        return {key:i.id,label:i.name,rows:selectedRows.filter(row=>ids.has(row.id))};
      }),
    };
  });
  return {summaries, metric, agents, indicators, total:rows.length, unit, matrixNote,
    title:({calls:'坐席通话量',completed:'坐席自动检测完成量',riskcalls:'坐席确认风险通话占比',risk:'坐席确认问题数'})[key],
    matrixTitle:key === 'risk' ? '坐席确认问题 · 预警指标分布' : '坐席通话 · 预警指标分布',
    // A percentage must retain each agent's own completed-call denominator.
    denominators:key === 'riskcalls' ? Object.fromEntries(agents.map(a=>[a.id,a.denominator])) : undefined,
  };
}
