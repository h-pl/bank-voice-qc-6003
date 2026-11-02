import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitial} from '../lib/fixtures.ts';
import {report, reportCsv} from '../lib/reports.ts';
import {reportTrend, reportVisuals, issueReportVisuals, teamReportVisuals, periodRows, periodMetric, visualMetric} from '../lib/report-visuals.ts';
const now = new Date('2026-09-13T10:00:00+08:00');
const filter = {business:'',group:'',agent:'',start:'2026-09-07',end:'2026-09-13'};
const sum = xs => xs.reduce((n,x)=>n+x,0);

test('V01: daily count and weighted ratios reconcile with source metrics, excluding live calls',()=>{
  const s=createInitial(now), metrics=report(s,filter,now), m=k=>metrics.find(x=>x.key===k);
  for(const key of ['calls','risk','coverage','fp']) {
    const {points}=reportTrend(s,metrics,key,filter,'2026-09-13');
    assert.equal(points.length,7);
    if(['coverage','fp'].includes(key)) {
      const n=sum(points.map(p=>p.count)),d=sum(points.map(p=>p.denominator));
      assert.equal(d,m(key).rows.length);
      assert.equal(d?`${(n/d*100).toFixed(1)}%`:'—',m(key).value);
      for(const p of points) assert.equal(p.value,p.denominator?p.count/p.denominator*100:null);
    } else assert.equal(sum(points.map(p=>p.count)),Number(m(key).value));
  }
  assert.ok(!m('calls').rows.some(r=>r.id==='CALL-1041'));
});
test('V02: Beijing midnight is the inclusive attribution boundary for drill-down and CSV',()=>{
  const rows=[{id:'before',date:'2026-09-12T15:59:59Z'},{id:'start',date:'2026-09-12T16:00:00Z'},{id:'end',date:'2026-09-13T15:59:59Z'},{id:'after',date:'2026-09-13T16:00:00Z'}].map(r=>({...r,callId:'',title:'边界测试',status:'已完成'}));
  const selected=periodRows(rows,'2026-09-13','2026-09-13');
  assert.deepEqual(selected.map(r=>r.id),['start','end']);
  const csv=reportCsv(visualMetric('day','所选日期',selected,'当前日期范围'),createInitial(now),now.toISOString(),filter);
  assert.match(csv,/start/);assert.match(csv,/end/);assert.ok(!csv.includes('before'));assert.ok(!csv.includes('after'));
});
test('V03: long ranges aggregate at most 31 buckets with no duplicate or lost samples',()=>{
  const s=createInitial(now), f={...filter,start:'2026-01-01',end:'2026-09-13'},ms=report(s,f,now);
  const t=reportTrend(s,ms,'calls',f,'2026-09-13');
  assert.ok(t.points.length<=31);assert.ok(t.stride>1);
  assert.equal(t.points[0].start,f.start);assert.equal(t.points.at(-1).end,f.end);
  assert.equal(sum(t.points.map(p=>p.count)),Number(ms.find(m=>m.key==='calls').value));
  const ids=t.points.flatMap(p=>periodRows(ms.find(m=>m.key==='calls').rows,p.start,p.end).map(r=>r.id));
  assert.equal(new Set(ids).size,ids.length);
});
test('V04: empty ratio dates and future dates remain absent, while historical count zero stays zero',()=>{
  const s=createInitial(now),f={...filter,start:'2026-09-01',end:'2026-09-20'},ms=report(s,f,now);
  const ratio=reportTrend(s,ms,'coverage',f,'2026-09-13'),counts=reportTrend(s,ms,'calls',f,'2026-09-13');
  assert.equal(ratio.points[0].value,null);assert.equal(counts.points[0].value,0);
  assert.ok(counts.points.filter(p=>p.start>'2026-09-13').every(p=>p.value===null));
  assert.equal(reportTrend(s,ms,'calls',{...f,start:'2026-09-21'},'2026-09-13').points.length,0);
});
test('V05: indicator bars, verdict segments and agent matrix reconcile and update with latest conclusions',()=>{
  const s=createInitial(now),ms=report(s,filter,now),v=reportVisuals(s,ms,filter);
  assert.equal(v.indicators.length,12);
  assert.equal(sum(v.indicators.map(i=>i.rows.length)),Number(ms.find(m=>m.key==='risk').value));
  assert.equal(sum(v.verdicts.map(g=>g.rows.length)),v.allFindings.length);
  assert.equal(sum(v.teams.flatMap(a=>a.indicators.map(i=>i.rows.length))),Number(ms.find(m=>m.key==='risk').value));
  const changed=structuredClone(s),f=changed.findings.find(f=>v.indicators.some(i=>i.rows.some(r=>r.id===f.id)));
  f.conclusions.push({...f.conclusions.at(-1),sequence:f.conclusions.at(-1).sequence+1,value:'false_positive'});
  const next=reportVisuals(changed,report(changed,filter,now),filter);
  assert.ok(!next.indicators.some(i=>i.rows.some(r=>r.id===f.id)));
  assert.ok(next.verdicts.find(g=>g.key==='false_positive').rows.some(r=>r.id===f.id));
});
test('V06: agent and business filters apply to every visualization; restricted roles expose no report rows',()=>{
  const s=createInitial(now),f={...filter,agent:'A1048',business:'信用卡'},ms=report(s,f,now),v=reportVisuals(s,ms,f);
  const allowed=new Set(s.calls.filter(c=>c.agentId===f.agent&&c.business===f.business&&c.endedAt).map(c=>c.id));
  assert.equal(v.teams.length,1);
  for(const r of [...v.allFindings,...v.indicators.flatMap(i=>i.rows),...v.teams.flatMap(a=>a.calls)]) assert.ok(allowed.has(r.callId));
  for(const identity of ['Q01','A1048']) {
    const a={...s,identity},metrics=report(a,f,now),v=reportVisuals(a,metrics,f);
    assert.deepEqual(metrics,[]);assert.deepEqual(v.allFindings,[]);
    assert.ok(v.indicators.every(i=>!i.rows.length));assert.ok(v.teams.every(a=>!a.calls.length));
  }
});
test('V07: selected-period ratio, denominator and export note use the selected period rather than overall totals',()=>{
  const s=createInitial(now),metrics=report(s,filter,now),period={start:'2026-09-13',end:'2026-09-13'};
  for(const key of ['calls','risk','coverage','fp']) {
    const m=periodMetric(s,metrics,key,period),p=reportTrend(s,metrics,key,filter,'2026-09-13').points.at(-1);
    assert.equal(m.rows.length,p.denominator??p.count);
    assert.equal(m.value,['coverage','fp'].includes(key)?p.value===null?'—':`${p.value.toFixed(1)}%`:String(p.count));
    const csv=reportCsv(m,s,now.toISOString(),filter);
    assert.ok(m.note.startsWith('所选日期 2026-09-13'));
    if(key==='coverage')assert.ok(m.note.includes(`已完成 ${p.count} / 已结束通话 ${p.denominator}`));
    if(m.rows.length)assert.ok(csv.includes(m.note));
  }
});


function warningReportState() {
  const state = createInitial(now), template = state.findings[0];
  const call = state.calls.find(c => c.endedAt && c.endedAt.startsWith('2026-09'));
  const records = [
    ['auto-risk', 'auto', '6.3.7', 'risk'], ['auto-fp', 'auto', '6.3.6', 'false_positive'],
    ['auto-insufficient', 'auto', '6.3.7', 'insufficient'], ['auto-pending', 'auto', '6.3.7', undefined],
    ['manual-risk', 'manual', '6.3.6', 'risk'], ['manual-fp', 'manual', '6.3.7', 'false_positive'],
    ['asr-risk', 'auto', '6.2.2', 'risk'], ['text-risk', 'auto', '6.2.4', 'risk'],
    ['policy-risk', 'auto', '6.3.4', 'risk'],
  ];
  state.findings = records.map(([id, source, indicator, value]) => ({...template, id, callId:call.id, source, indicator,
    conclusions:value ? [{sequence:1,value,note:'测试结论',at:now.toISOString()}] : [],
  }));
  return state;
}

test('V08: issue cards, indicator bars and verdicts use one warning population for each selection', () => {
  const state = warningReportState(), metrics = report(state, filter, now);
  const expected = { candidates:['auto-risk','auto-fp','auto-insufficient','auto-pending'], risk:['auto-risk','manual-risk'], manual:['manual-risk','manual-fp'], fp:['auto-risk','auto-fp'] };
  for (const [key, ids] of Object.entries(expected)) {
    const result = issueReportVisuals(state, metrics, key);
    assert.deepEqual(result.metric.rows.map(r=>r.id).sort(), ids.toSorted());
    assert.deepEqual(result.indicators.flatMap(g=>g.rows.map(r=>r.id)).sort(), ids.toSorted());
    assert.deepEqual(result.verdicts.flatMap(g=>g.rows.map(r=>r.id)).sort(), ids.toSorted());
    assert.equal(result.total, ids.length);
    assert.ok(!result.indicators.some(g=>['6.2.2','6.2.4','6.3.4'].includes(g.key)));
    assert.equal(result.metric.value, key === 'fp' ? '50.0%' : String(ids.length));
  }
});

test('V09: false-positive distribution and export retain only the confirmed automatic denominator', () => {
  const state = warningReportState(), result = issueReportVisuals(state, report(state,filter,now), 'fp');
  assert.equal(result.verdicts.find(g=>g.key==='false_positive').rows.length, 1);
  assert.equal(result.verdicts.find(g=>g.key==='risk').rows.length, 1);
  assert.equal(result.verdicts.find(g=>g.key==='insufficient').rows.length, 0);
  assert.equal(result.verdicts.find(g=>g.key==='pending').rows.length, 0);
  assert.match(result.metric.note, /误报 1.*成立）2/);
  const output = reportCsv(result.metric,state,now.toISOString(),filter);
  assert.ok(output.includes('auto-risk') && output.includes('auto-fp'));
  for (const excluded of ['manual-risk','manual-fp','auto-insufficient','auto-pending','asr-risk','text-risk','policy-risk']) assert.ok(!output.includes(excluded));
});

test('V10: issue linkage respects filters, missing denominators, latest conclusions and role permissions', () => {
  const state=warningReportState(), metrics=report(state,filter,now);
  const before=issueReportVisuals(state,metrics,'risk');
  state.findings.find(f=>f.id==='auto-risk').conclusions.push({sequence:2,value:'false_positive',note:'更正',at:now.toISOString()});
  const changed=report(state,filter,now);
  assert.equal(issueReportVisuals(state,changed,'risk').total,before.total-1);
  assert.equal(issueReportVisuals(state,changed,'fp').metric.value,'100.0%');
  const empty=issueReportVisuals(state,report(state,{...filter,business:'不存在'},now),'fp');
  assert.equal(empty.metric.value,'—');assert.equal(empty.total,0);
  assert.ok(empty.indicators.every(g=>g.rows.length===0));
  for(const identity of ['Q01','A1048']) {
    const restricted={...state,identity};
    const result=issueReportVisuals(restricted,report(restricted,filter,now),'risk');
    assert.equal(result.total,0);assert.deepEqual(result.summaries,[]);
  }
});


function teamReportState() {
  const state=createInitial(now), callTemplate=state.calls[0], findingTemplate=state.findings[0];
  state.calls=['A','B','C','D','E'].map((id,index)=>({...structuredClone(callTemplate),id:`call-${id}`,
    agentId:index<2?'A1048':'A1186',group:index<2?'客服一组':'客服二组',endedAt:now.toISOString(),
    batches:[{...callTemplate.batches[0],checks:[{name:'测试检查',state:id==='B'?'failed':'success'}]}],
  }));
  state.findings=[['A1','A','6.3.7','risk'],['A2','A','6.3.7','risk'],['A3','A','6.3.6','risk'],
    ['B1','B','6.3.7','risk'],['C1','C','6.3.6','false_positive'],['E1','E','6.2.2','risk']]
    .map(([id,call,indicator,value])=>({...findingTemplate,id,callId:`call-${call}`,indicator,source:'auto',
      conclusions:[{sequence:1,value,note:'测试结论',at:now.toISOString()}],
    }));
  return state;
}

test('V11: team cards drive agent groups and matrices, preserving normal calls and warning dimensions',()=>{
  const state=teamReportState(),metrics=report(state,filter,now);
  for(const [key,total] of [['calls',5],['completed',4],['riskcalls',1],['risk',4]]) {
    const result=teamReportVisuals(state,metrics,filter,key);
    assert.equal(result.total,total);
    assert.equal(sum(result.agents.map(a=>a.rows.length)),total);
    assert.ok(!result.indicators.some(i=>['6.2.2','6.2.4','6.3.4'].includes(i.id)));
    const sourceIds=new Set(result.metric.rows.map(r=>r.id));
    for(const row of result.agents.flatMap(a=>a.indicators.flatMap(i=>i.rows)))assert.ok(sourceIds.has(row.id));
  }
  const all=teamReportVisuals(state,metrics,filter,'calls');
  assert.ok(all.metric.rows.some(r=>r.id==='call-D'),'normal call stays in workload');
  assert.equal(all.agents[0].indicators.find(i=>i.key==='6.3.7').rows.length,2,'same call counted once per indicator');
  const risks=teamReportVisuals(state,metrics,filter,'risk');
  assert.equal(risks.agents[0].indicators.find(i=>i.key==='6.3.7').rows.length,3,'problem mode counts distinct findings');
});

test('V12: team risk-call ratios use completed calls per agent and a weighted aggregate',()=>{
  const state=teamReportState(),metrics=report(state,filter,now),result=teamReportVisuals(state,metrics,filter,'riskcalls');
  assert.equal(result.metric.value,'25.0%');
  assert.deepEqual(result.agents.map(a=>a.value),['100.0%','0.0%']);
  assert.deepEqual(result.denominators,{A1048:1,A1186:3});
  assert.deepEqual(result.metric.rows.map(r=>r.id),['call-A']);
  const f={...filter,agent:'A1186'},single=teamReportVisuals(state,report(state,f,now),f,'riskcalls');
  assert.equal(single.agents.length,1);assert.equal(single.metric.value,'0.0%');
  const emptyFilter={...filter,business:'不存在'},empty=teamReportVisuals(state,report(state,emptyFilter,now),emptyFilter,'riskcalls');
  assert.equal(empty.metric.value,'—');assert.ok(empty.agents.every(a=>a.value==='—'));
  const restricted={...state,identity:'Q01'};
  assert.equal(teamReportVisuals(restricted,report(restricted,filter,now),filter,'risk').total,0);
});
