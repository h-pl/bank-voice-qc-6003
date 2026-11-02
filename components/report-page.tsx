"use client";
import { remedyReportStages } from "../lib/report-status";
import { ResetFiltersButton } from "./reset-filters-button";
import { CopyRecordId } from "./record-id";
import { SurfaceButton } from "./ui/button";
import { DatePicker } from "./ui/date-picker";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";
import { SelectField } from "./select-field";
import { useRef, useState } from 'react';
import { useDemoClock } from '../lib/store';
import { report, reportCsv, localDate, type Metric, type ReportFilter } from '../lib/reports';
import { reportTrend, reportVisuals, issueReportVisuals, teamReportVisuals, periodMetric, visualMetric, type IssueMetricKey, type TeamMetricKey, type TrendPoint } from '../lib/report-visuals';
import { people, type State } from '../lib/workflow';
import { Button, Empty, MetricSummary } from './ui';
import { download, stamp, Pagination } from './workspace';
import { TrendChart, RingChart, HorizontalBars, chartColors, formatNumber } from './report-charts';
import './report-page.css';

import { reportModules, type ReportModule as Tab } from '../lib/report-navigation';
type Selection = { kind: 'metric' | 'indicator' | 'verdict' | 'team'; key: string; agent?: string; period?: Pick<TrendPoint, 'start' | 'end'> };
const summaries: Record<Tab, string[]> = { overview: ['calls', 'coverage', 'risk', 'fp'], issues: ['candidates', 'risk', 'manual', 'fp'], teams: ['calls', 'completed', 'riskcalls', 'risk'], improvement: [] };
const detectionGroups = [ ['completed', '已完成', chartColors.green], ['partial', '部分失败', chartColors.orange], ['failed', '失败', chartColors.red], ['running', '处理中', chartColors.slate], ['pending', '待处理', chartColors.gray] ];
const stages = remedyReportStages;
const verdictColors = [chartColors.red, chartColors.green, chartColors.orange, chartColors.gray];
const initialMetric = (tab: Tab) => tab === 'improvement' ? 'appealchange' : tab === 'issues' ? 'risk' : 'calls';

function Summary({ metrics, selected, onSelect, unit = '项' }: { metrics: Metric[]; selected: string; onSelect: (key: string) => void; unit?: string }) {
  return <MetricSummary label="分析指标" selected={selected} onSelect={onSelect} items={metrics.map(m=>({key:m.key,label:m.label,value:<>{m.value.includes('%') || m.value === '—' ? m.value : formatNumber(Number(m.value))}<small>{m.value.includes('%') || m.value === '—' ? '' : ['calls','completed'].includes(m.key) ? '通' : unit}</small></>,hint:m.note.split('；')[0]}))}/>;
}

export function ReportPage({ state, onOpen, module = "overview" }: { state: State; onOpen: (id: string) => void; module?:Tab }) {
  const clock = useDemoClock(), today = localDate(new Date(clock).toISOString());
  const [filter, setFilter] = useState<ReportFilter>(() => ({ business: '', group: '', agent: '', start: localDate(new Date(Date.now() - 6 * 86400000).toISOString()), end: localDate(new Date().toISOString()) }));
  const tab=module, moduleInfo=reportModules.find(item=>item.id===module)!;
  const [selection, setSelection] = useState<Selection>({ kind: 'metric', key: initialMetric(module) }), [trendKey, setTrendKey] = useState('calls');
  const [issueKey, setIssueKey] = useState<IssueMetricKey>('risk');
  const [teamKey, setTeamKey] = useState<TeamMetricKey>('calls');
  const activeMetric = tab === 'overview' ? trendKey : tab === 'issues' ? issueKey : tab === 'teams' ? teamKey : initialMetric(tab);
  const [page, setPage] = useState(1), [size, setSize] = useState(5);
  const detail = useRef<HTMLElement>(null);
  const asOf = new Date(clock).toISOString();
  const invalid = !!filter.start && !!filter.end && filter.start > filter.end;
  const metrics = report(state, filter, new Date(asOf)), byKey = new Map(metrics.map(m => [m.key, m]));
  const visuals = reportVisuals(state, metrics, filter);
  const issueVisuals = issueReportVisuals(state, metrics, issueKey);
  const teamVisuals = teamReportVisuals(state, metrics, filter, teamKey);
  const m = (key: string) => byKey.get(key)!;
  const num = (key: string) => Number(byKey.get(key)?.value ?? 0);
  const matrixPeak = Math.max(1, ...teamVisuals.agents.flatMap(t => t.indicators.map(x => x.rows.length)));
  const stageTotal = stages.reduce((sum, [key]) => sum + num(`remedy-state-${key}`), 0);
  let selected: Metric | undefined = (tab === 'issues' ? issueVisuals.summaries : tab === 'teams' ? teamVisuals.summaries : []).find(metric => metric.key === selection.key) ?? byKey.get(selection.key);
  if (tab === 'teams' && selection.kind === 'indicator') {
    const agent=teamVisuals.agents.find(a=>a.id===selection.agent), indicator=agent?.indicators.find(i=>i.key===selection.key);
    if(agent && indicator) selected=visualMetric(`agent-${agent.id}-indicator-${indicator.key}`, `${agent.name} · ${indicator.label}`, indicator.rows, `${teamVisuals.metric?.label}；${teamVisuals.matrixNote}`);
  } else if (selection.kind === 'indicator') {
    const i = (tab === 'issues' ? issueVisuals.indicators : visuals.indicators).find(i => i.key === selection.key), agent = visuals.teams.find(a => a.id === selection.agent);
    if (i) selected = visualMetric(`indicator-${i.key}${agent ? `-${agent.id}` : ''}`, `${agent ? agent.name + ' · ' : ''}${i.label}`, agent ? agent.indicators.find(x => x.key === i.key)!.rows : i.rows, tab === 'issues' ? `${issueVisuals.metric?.label}；${issueVisuals.note}；按所选通话结束日期` : '当前有效成立问题；按所选通话结束日期与主指标去重统计');
  } else if (selection.kind === 'verdict') {
    const v = (tab === 'issues' ? issueVisuals.verdicts : visuals.verdicts).find(v => v.key === selection.key);
    if (v) selected = visualMetric(`verdict-${v.key}`, v.label, v.rows, tab === 'issues' ? `${issueVisuals.metric?.label}；仅预警指标；按所选通话结束日期与当前结论` : '按所选通话结束日期；自动候选与人工发现的当前判定构成');
  } else if (selection.kind === 'team') {
    const a=teamVisuals.agents.find(a=>a.id===selection.key);
    if(a) selected={...visualMetric(`agent-${a.id}-${teamKey}`, `${a.name} · ${teamVisuals.metric?.label}`, a.rows, teamKey === 'riskcalls' ? `确认风险 ${a.rows.length} / 自动检测完成 ${a.denominator} 通；${a.value}；按所选通话结束日期` : `${teamVisuals.metric?.note}`), value:a.value};
  }
  selected ??= tab === 'issues' ? issueVisuals.metric : tab === 'teams' ? teamVisuals.metric : byKey.get(initialMetric(tab));
  if (selection.period) selected = periodMetric(state, metrics, selection.key, selection.period);
  const current = Math.min(page, Math.max(1, Math.ceil((selected?.rows.length ?? 0) / size)));
  const select = (next: Selection, inspect = false) => { setSelection(next);setPage(1);if (inspect) detail.current?.focus({ preventScroll: false }); };
  const selectMetric = (key: string, inspect = false) => select({ kind: 'metric', key }, inspect);
  const set = (key: keyof ReportFilter, value: string) => { setFilter(f => ({ ...f, [key]: value }));selectMetric(activeMetric); };
  const range = (days: number) => ({ start: localDate(new Date(Date.parse(today + 'T12:00:00+08:00') - (days - 1) * 86400000).toISOString()), end: today });
  const rangeLabel = `${filter.start || '不限开始'} — ${filter.end || '不限结束'}`;
  const trend = reportTrend(state, metrics, trendKey, filter, today);
  const detailKeys = tab === 'overview' ? ['riskcalls', 'candidates', 'manual'] : tab === 'issues' ? issueKey === 'risk' ? ['riskappealing'] : [] : tab === 'improvement' ? ['review-overdue', 'appeal-overdue', 'remedy-overdue', 'paused', 'materialpending', 'extended', 'everoverdue', 'sourcechanged', 'review-due', 'appeal-due', 'remedy-due', 'terminated'] : [];
  if (!metrics.length) return <Empty text="当前角色无质量报表权限"/>;
  return <div className="qa-analytics report-workspace">

    <div role="region" aria-label={moduleInfo.title}>
    <section className="qa-filter-panel" aria-label="报表筛选"><div className="qa-filter-fields">
      <label>开始日期<DatePicker name="report-start" aria-label="报表开始日期" value={filter.start} aria-invalid={invalid} aria-describedby={invalid ? 'report-date-error' : undefined} onValueChange={value => set('start', value)}/></label>
      <label>结束日期<DatePicker name="report-end" aria-label="报表结束日期" value={filter.end} aria-invalid={invalid} aria-describedby={invalid ? 'report-date-error' : undefined} onValueChange={value => set('end', value)}/></label>
      <label>业务<SelectField name="report-business" aria-label="报表业务" value={filter.business} onValueChange={value => set('business', value)}><option value="">全部业务</option>{['账户查询', '信用卡', '转账汇款'].map(x => <option key={x}>{x}</option>)}</SelectField></label>
      <label>班组<SelectField name="report-group" aria-label="报表班组" value={filter.group} onValueChange={value => { setFilter(f => ({ ...f, group: value, agent: '' }));selectMetric(activeMetric); }}><option value="">全部班组</option><option>客服一组</option><option>客服二组</option></SelectField></label>
      <label>坐席<SelectField name="report-agent" aria-label="报表坐席" value={filter.agent} onValueChange={value => set('agent', value)}><option value="">全部坐席</option>{people.filter(p => p.role === 'agent' && (!filter.group || state.calls.some(c => c.agentId === p.id && c.group === filter.group))).map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</SelectField></label>
    </div><div className="qa-filter-footer"><span>北京时间 · 截至 {stamp(asOf)}</span><div className="qa-date-shortcuts">{[7, 14, 30].map(days => <SurfaceButton type="button" key={days} aria-pressed={filter.start === range(days).start && filter.end === today} onClick={() => { setFilter(f => ({ ...f, ...range(days) }));selectMetric(activeMetric); }}>近 {days} 天</SurfaceButton>)}<ResetFiltersButton active={!!(filter.business || filter.group || filter.agent || filter.start !== range(7).start || filter.end !== today)} onClick={() => { setFilter({ business: '', group: '', agent: '', ...range(7) });selectMetric(activeMetric); }}/></div></div>
      {invalid && <p className="qa-date-error" id="report-date-error" role="alert">开始日期不能晚于结束日期。<SurfaceButton type="button" onClick={() => { setFilter(f => ({ ...f, start: f.end, end: f.start }));setPage(1); }}>交换日期</SurfaceButton></p>}
    </section>
    {!invalid && <>
      <div className="qa-context"><span>{tab === 'improvement' ? '期间结果按日期统计；整改状态与跟进期限截至当前时刻' : '按通话结束日期；问题使用当前有效结论'}</span></div>
      <section className="qa-analysis-panel">

        {summaries[tab].length > 0 && <section className="qa-summary-panel" aria-label="统计摘要">
        <Summary unit={tab === 'issues' || tab === 'teams' ? '条' : '项'} metrics={tab === 'issues' ? issueVisuals.summaries : tab === 'teams' ? teamVisuals.summaries : summaries[tab].map(key => m(key))} selected={tab !== 'improvement' ? activeMetric : selection.key} onSelect={key => { selectMetric(key);if (tab === 'overview') setTrendKey(key);if (tab === 'issues') setIssueKey(key as IssueMetricKey);if (tab === 'teams') setTeamKey(key as TeamMetricKey); }}/>
        </section>}
        {tab === 'overview' && <div className="qa-charts-grid"><div>{num('calls') ? <TrendChart key={`${trendKey}-${rangeLabel}-${filter.business}-${filter.group}-${filter.agent}`} points={trend.points} stride={trend.stride} metric={m(trendKey)} onInspect={period => select({ kind: 'metric', key: trendKey, period }, true)}/> : <Empty text="所选期间暂无通话记录" hint="调整日期或业务范围后查看趋势。" action={state.calls.some(c=>c.endedAt) ? <Button onClick={()=>{const dates=state.calls.filter(c=>c.endedAt && (!filter.business || c.business===filter.business) && (!filter.group || c.group===filter.group) && (!filter.agent || c.agentId===filter.agent)).map(c=>localDate(c.endedAt!)).sort();if(dates.length){setFilter(f=>({...f,start:dates[0],end:dates.at(-1)!}));selectMetric(trendKey);}else{setFilter({business:"",group:"",agent:"",start:"",end:""});selectMetric(trendKey);}}}>查看有数据的时段</Button> : undefined}/>}</div><RingChart title="检测状态" note="范围内已结束通话 · 通" center={m('coverage').value} centerLabel="自动处理成功占比" groups={detectionGroups.map(([key, label, color]) => ({ key, label, color, count: num(key) }))} onSelect={key => selectMetric(key, true)}/></div>}
        {tab === 'issues' && <div className="qa-charts-grid"><section className="qa-chart-region"><div className="qa-chart-heading"><div><h2>{issueVisuals.title}</h2><p>{issueVisuals.note}</p></div><span className="qa-window">{issueVisuals.total} 条问题</span></div>{issueVisuals.total ? <HorizontalBars unit="条" groups={issueVisuals.indicators.toSorted((a, b) => b.rows.length - a.rows.length)} total={issueVisuals.total} onSelect={key => select({ kind: 'indicator', key }, true)}/> : <Empty text="当前范围暂无对应问题" hint="可切换上方指标或调整日期与业务范围。"/>}</section><RingChart key={issueKey} title={issueKey === 'fp' ? '误报判定构成' : `${issueVisuals.metric?.label ?? '问题'} · 判定构成`} note={issueKey === 'fp' ? '已判定自动预警 · 成立与误报' : '所选指标范围 · 当前结论'} center={issueKey === 'fp' ? issueVisuals.metric?.value : undefined} centerLabel={issueKey === 'fp' ? '误报占比' : undefined} groups={issueVisuals.verdicts.map((v, i) => ({ key: v.key, label: v.label, count: v.rows.length, color: verdictColors[i] }))} onSelect={key => select({ kind: 'verdict', key }, true)}/></div>}
        {tab === 'teams' && <div className="qa-team-charts"><section className="qa-chart-region"><div className="qa-chart-heading"><div><h2>{teamVisuals.title}</h2><p>{teamVisuals.metric?.note}</p></div><span className="qa-window">{teamKey === 'riskcalls' ? teamVisuals.metric?.value : `${teamVisuals.total} ${teamVisuals.unit}`}</span></div><HorizontalBars groups={teamVisuals.agents.map(a => ({ key:a.id,label:a.name,rows:a.rows }))} total={teamVisuals.total} denominators={teamVisuals.denominators} unit={teamVisuals.unit} onSelect={key => select({ kind:'team',key },true)} color={chartColors.slate}/></section><section className="qa-matrix-region"><div className="qa-chart-heading"><div><h2>{teamVisuals.matrixTitle}</h2><p>{teamVisuals.matrixNote}</p></div><div className="qa-heat-legend"><span>少</span>{[0,1,2,3].map(i=><i key={i} className={`level-${i}`}/>)}<span>多</span></div></div><div className="qa-matrix-scroll"><Table className="qa-matrix"><TableHeader><TableRow><TableHead>坐席</TableHead>{teamVisuals.indicators.map(i=><TableHead key={i.id}>{i.name}</TableHead>)}</TableRow></TableHeader><TableBody>{teamVisuals.agents.map(a=><TableRow key={a.id}><TableHead>{a.name}<small>{a.group}</small></TableHead>{a.indicators.map(i=>{const level=i.rows.length?Math.max(1,Math.ceil(i.rows.length/matrixPeak*3)):0;return <TableCell key={i.key}><SurfaceButton className={`level-${level}`} aria-label={`${a.name}，${i.label}，${i.rows.length}${teamVisuals.unit}，查看明细`} onClick={()=>select({kind:'indicator',key:i.key,agent:a.id},true)}>{i.rows.length}</SurfaceButton></TableCell>;})}</TableRow>)}</TableBody></Table></div></section></div>}
        {tab === 'improvement' && <div className="qa-charts-grid"><section className="qa-chart-region"><div className="qa-chart-heading"><div><h2>整改当前状态</h2><p>互斥基础状态，暂停与补件作为附加标记</p></div><span className="qa-window">{stageTotal} 项</span></div><div className="qa-stage-list">{stages.map(([key, label], i) => { const value = num(`remedy-state-${key}`), total = stageTotal;return <SurfaceButton key={key} onClick={() => selectMetric(`remedy-state-${key}`, true)}><span className="qa-dot" style={{ background: [chartColors.gray, chartColors.orange, chartColors.slate, '#9b8a75', chartColors.green, chartColors.red][i % 6] }}/><span>{label}</span><div className="qa-bar-track"><i style={{ width: `${value / Math.max(1, total) * 100}%`, background: [chartColors.gray, chartColors.orange, chartColors.slate, '#9b8a75', chartColors.green, chartColors.red][i % 6] }}/></div><b>{value}</b><small>项</small></SurfaceButton>;})}</div></section><section className="qa-period-results"><div className="qa-chart-heading"><div><h2>所选期间结果</h2><p>裁定按裁定日，按时办结按有效到期日</p></div></div>{['appealchange', 'review-ontime', 'appeal-ontime', 'ontime'].map(key => <SurfaceButton key={key} onClick={() => selectMetric(key, true)}><span>{m(key).label}</span><strong>{m(key).value}<small>{key === 'appealchange' ? '' : '项'}</small></strong><small>{key === 'appealchange' ? m(key).note : '曾逾期记录不计入；仅显示数量'}</small></SurfaceButton>)}</section></div>}
      </section>
      {tab==='overview'&&<section className="qa-secondary-panel" aria-label="通话告警概览"><div className="qa-section-title"><h2>通话告警</h2><span>按通话汇总状态；风险分布仅统计未关闭告警</span></div><div className="qa-secondary-metrics">{['alerts','alerts-pending','alerts-open','alerts-closed','alert-high','alert-medium','alert-low','alert-none'].map(key=><SurfaceButton key={key} aria-pressed={selection.key===key} onClick={()=>selectMetric(key,true)}><span>{m(key).label}</span><b>{m(key).value}</b></SurfaceButton>)}</div></section>}
      {detailKeys.length > 0 && <section className="qa-secondary-panel" aria-label={tab === 'improvement' ? '跟进与期限指标' : '相关指标'}><div className="qa-section-title"><h2>{tab === 'improvement' ? '跟进与期限' : '相关指标'}</h2></div><div className="qa-secondary-metrics">{detailKeys.map(key => <SurfaceButton key={key} aria-pressed={selection.key === key} onClick={() => selectMetric(key, true)}><span>{m(key).label}</span><b>{m(key).value}</b></SurfaceButton>)}</div></section>}
      {tab === 'teams' && <section className="qa-data-panel qa-team-detail"><div className="qa-section-title"><h2>坐席 / 班组明细 · {teamVisuals.metric?.label}</h2><span>以下数据随所选卡片变化；问题仅统计预警指标</span></div><div className="qa-table-scroll"><Table><TableHeader><TableRow><TableHead>坐席 / 班组</TableHead><TableHead className="qa-numeric">{teamVisuals.metric?.label}</TableHead><TableHead className="qa-numeric">关联通话数</TableHead><TableHead className="qa-numeric">问题数</TableHead><TableHead className="qa-numeric">确认问题</TableHead><TableHead className="qa-numeric">自动误报</TableHead><TableHead className="qa-numeric">人工撤销</TableHead><TableHead className="qa-numeric">证据不足</TableHead></TableRow></TableHeader><TableBody>{teamVisuals.agents.map(a=><TableRow key={a.id}><TableCell><SurfaceButton className="text-button" onClick={()=>select({kind:'team',key:a.id},true)}>{a.name}</SurfaceButton><small>{a.group}</small></TableCell><TableCell className="qa-numeric">{a.value}{teamKey==='riskcalls'&&<small>确认风险 {a.rows.length} / 已完成 {a.denominator}</small>}</TableCell>{[a.callCount,a.findingCount,a.risk,a.fp,a.manualRevoked,a.insufficient].map((n,i)=><TableCell key={i} className="qa-numeric">{n}</TableCell>)}</TableRow>)}</TableBody></Table></div></section>}
      {selected && <section className="qa-data-panel qa-detail" ref={detail} tabIndex={-1} aria-label="报表明细"><div className="qa-detail-heading"><div><h2>{selected.label}<span>{selected.rows.length} 条</span></h2><p>{selected.note}</p></div><div>{selection.period && <SurfaceButton className="text-button" onClick={() => selectMetric(selection.key)}>查看全期间</SurfaceButton>}<Button icon="download" onClick={() => download(reportCsv(selected!, state, asOf, filter), `${selected!.key}-P0-1.1.csv`)}>导出当前明细</Button></div></div><div className="qa-table-scroll"><Table><TableHeader><TableRow><TableHead>对象编号</TableHead><TableHead>关联通话</TableHead><TableHead>事项</TableHead><TableHead>状态 / 结果</TableHead><TableHead>归属时间</TableHead><TableHead>操作</TableHead></TableRow></TableHeader><TableBody>{selected.rows.slice((current - 1) * size, current * size).map(r => <TableRow key={r.id}><TableCell className="qa-object-id"><CopyRecordId id={r.id}/></TableCell><TableCell><CopyRecordId id={r.callId}/></TableCell><TableCell>{r.title}</TableCell><TableCell><span className={`qa-result ${r.status.includes('失败') || r.status.includes('风险成立') ? 'risk' : r.status.includes('完成') || r.status.includes('误报') ? 'good' : ''}`}>{r.status}</span></TableCell><TableCell>{stamp(r.date)}</TableCell><TableCell><SurfaceButton className="text-button" onClick={() => onOpen(r.id)}>查看事项</SurfaceButton></TableCell></TableRow>)}</TableBody></Table>{!selected.rows.length && <Empty text="当前口径下没有记录" hint="可切换图表分类或调整筛选；比例分母为零时显示 —。"/>}</div><Pagination page={current} size={size} total={selected.rows.length} onPage={setPage} onSize={n => { setSize(n);setPage(1); }}/></section>}
    </>}
    </div>
  </div>;
}
