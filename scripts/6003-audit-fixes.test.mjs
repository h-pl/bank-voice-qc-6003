import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {apply,entity,latest,actions} from '../lib/workflow.ts';
import {captureRules,policyFor,validateConditions} from '../lib/configuration.ts';
import {ingestDetection,reconcileAlerts,problemFinished,detectionComplete} from '../lib/call-alerts.ts';
import {report} from '../lib/reports.ts';
import {callTriggers} from '../lib/call-triggers.ts';
import {ensureSystemSettings} from '../lib/configuration-schema.ts';
const now=new Date('2026-10-31T08:00:00Z');
const run=(s,id,action,input={},at=now)=>apply(s,{id,rev:entity(s,id).rev,action,requestId:crypto.randomUUID(),input},at);
function fresh(){const s=createPrototypeState(now);s.calls=[s.calls[0]];const c=s.calls[0];c.endedAt=now.toISOString();c.batches=[{id:'B-fixes',startedAt:now.toISOString(),rules:captureRules(s,now.toISOString()),checks:[{name:'检测',state:'running'}]}];for(const k of ['findings','reviews','appeals','remedies','supplements','alerts','logs','notificationDeliveries'])s[k]=[];return s;}
function event(s,ruleId='R-COM-012',problemKey='same-problem'){const c=s.calls[0],condition=c.batches.at(-1).rules.find(r=>r.ruleId===ruleId).conditions[0];return {key:crypto.randomUUID(),problemKey,callId:c.id,batchId:c.batches.at(-1).id,ruleId,feature:condition.feature,role:condition.role,stage:condition.stage,count:10,duration:30,atSecond:20,evidence:[0],title:'待核对业务问题'};}
const close=s=>{s.calls[0].batches.at(-1).checks[0].state='success';return run(s,s.findings[0].id,'dismiss',{value:'false_positive',note:'核对全部上下文，确认误报',evidence:[0]});};
test('D01/D04: same problem across rules and batches has one workflow, each hit remains traceable',()=>{
 let s=fresh();s=ingestDetection(s,event(s),now);s=ingestDetection(s,event(s,'R-BAN-001'),now);
 assert.equal(s.findings.length,1);assert.equal(s.findings[0].hits.length,2);assert.equal(s.alerts[0].problemIds.length,1);
 const original=s.findings[0].batchId;s.calls[0].batches[0].checks[0].state='success';s=run(s,s.calls[0].id,'start_detection');s=run(s,s.calls[0].id,'finish_detection',{value:'success'});
 assert.equal(s.findings.length,1);assert.equal(s.findings[0].batchId,original);assert.equal(s.findings[0].hits.length,4);assert.equal(callTriggers(s.calls[0],s.findings).ruleCount,2);assert.equal(callTriggers(s.calls[0],s.findings).indicatorCount,2);
});
test('D02: changing policy level never rewrites appeal-review deadlines',()=>{
 let s=createPrototypeState(now);const r=s.reviews.find(r=>r.type==='appeal'&&!['done','cancelled'].includes(r.status)&&s.findings.find(f=>f.id===r.findingIds[0])?.source==='auto'),f=s.findings.find(f=>f.id===r.findingIds[0]);const due=r.dueAt;
 for(const level of ['low','high']){const p=policyFor(s,f.ruleId);s=run(s,p.id,'save_policy',{policy:{...p,level}});assert.equal(s.reviews.find(x=>x.id===r.id).dueAt,due);}
});
test('D03/D09/D11: report states partition totals, risk distribution excludes closed, rows drill into alerts',()=>{
 const s=createPrototypeState(now),metrics=report(s,{start:'',end:'',business:'',group:'',agent:''},now),get=k=>metrics.find(m=>m.key===k);
 const open=Number(get('alerts-open').value)+Number(get('alerts-pending').value);
 assert.equal(open+Number(get('alerts-closed').value),Number(get('alerts').value));assert.equal(['high','medium','low','none'].reduce((sum,k)=>sum+Number(get('alert-'+k).value),0),open);assert.ok(get('alerts-closed').rows.length>0);assert.ok(get('alerts').rows.every(r=>s.alerts.some(a=>a.id===r.id)));
});
test('D05: invalid resource feature, unsupported role/mode rejected; disabled and hidden conditions ignored',()=>{
 let s=fresh();const intent=s.resources.find(r=>r.kind==='intent');assert.throws(()=>run(s,intent.id,'save_resource',{content:intent.content.replaceAll('查询转账进度','新意图')}),/失效/);
 const voice=s.resources.find(r=>r.kind==='voice'),rows=structuredClone(s.rules.find(r=>r.resourceId===voice.id).conditions);rows[0].role='客户';assert.throws(()=>validateConditions(rows,voice),/角色/);rows[0].role='坐席';rows[0].mode='持续时长';assert.throws(()=>validateConditions(rows,voice),/触发方式/);rows[0].enabled=false;validateConditions(rows,voice);
 const privacy=s.resources.find(r=>r.kind==='privacy'),cs=structuredClone(s.rules.find(r=>r.resourceId===privacy.id).conditions);cs[0].count=0;cs[0].duration=-1;validateConditions(cs,privacy);
 const basis=s.calls[0].batches[0].rules.find(r=>r.ruleId==='R-COM-012');basis.conditions[0].enabled=false;s=ingestDetection(s,event(s),now);assert.equal(s.findings.length,0);
});
test('D05: service-middle range waits for end and excludes short calls',()=>{
 for(const ended of [false,true]){let s=fresh();if(!ended)delete s.calls[0].endedAt;else s.calls[0].duration=20;const condition=s.calls[0].batches[0].rules.find(r=>r.ruleId==='R-COM-012').conditions[0];Object.assign(condition,{stage:'服务中',middleStartSeconds:10,middleEndSeconds:30});s=ingestDetection(s,event(s),now);assert.equal(s.findings.length,0);}
});
test('D06: current policy levels change but original hit snapshot and historical maximum remain',()=>{
 let s=fresh();s=ingestDetection(s,event(s),now);const snapshot=structuredClone(s.findings[0].hits[0].policy),p=policyFor(s,'R-COM-012');s=run(s,p.id,'save_policy',{policy:{...p,level:'low',recipients:['agent']}});
 assert.equal(s.alerts[0].level,'low');assert.equal(s.alerts[0].highestLevel,'high');assert.deepEqual(s.findings[0].hits[0].policy,snapshot);s=close(s);assert.equal(s.alerts[0].closingLevel,'low');assert.equal(s.alerts[0].closeResult,'excluded');
});
test('D07: completed evidence requires supervisor decision; reopen keeps conclusions and permits new triage',()=>{
 let s=fresh();s=ingestDetection(s,event(s),now);s=close(s);const id=s.alerts[0].id,conclusion=structuredClone(s.findings[0].conclusions);s=ingestDetection(s,{...event(s),evidence:[1]},now);
 assert.equal(s.alerts[0].status,'closed');assert.deepEqual(s.findings[0].evidence,[0]);assert.equal(s.findings[0].pendingEvidence.hitIds.length,1);
 assert.throws(()=>run({...s,identity:s.calls[0].agentId},s.findings[0].id,'review_new_evidence',{value:'reopen',note:'新增证据需重新核对'}),/仅主管/);
 s=run(s,s.findings[0].id,'review_new_evidence',{value:'reopen',note:'新增证据需重新核对'});assert.equal(s.alerts[0].id,id);assert.equal(s.alerts[0].status,'open');assert.equal(problemFinished(s,s.findings[0]),false);assert.deepEqual(s.findings[0].conclusions,conclusion);assert.equal(latest(s.findings[0]),undefined);assert.ok(actions(s,s.findings[0].id).includes('dismiss'));
 s=run(s,s.findings[0].id,'dismiss',{value:'false_positive',note:'再次核对仍为保护性提醒',evidence:[0,1]},new Date(now.getTime()+1000));assert.equal(latest(s.findings[0]).sequence,2);assert.equal(s.alerts[0].status,'closed');
});
test('D07: retaining closed evidence stores decision without changing formal conclusion',()=>{
 let s=fresh();s=ingestDetection(s,event(s),now);s=close(s);const original=structuredClone(s.findings[0].conclusions);s=ingestDetection(s,{...event(s),evidence:[1]},now);s=run(s,s.findings[0].id,'review_new_evidence',{value:'retain',note:'新增证据仍支持原结论'});assert.equal(s.alerts[0].status,'closed');assert.equal(s.findings[0].pendingEvidence,undefined);assert.deepEqual(s.findings[0].conclusions,original);
});
test('D08: invalid flow rejected on save and unavailable runtime route explicitly notifies supervisor',()=>{
 let s=fresh(),p=policyFor(s,'R-COM-012');s=run(s,p.id,'save_policy',{policy:{...p,recipients:['agent'],flowId:'special-review'}});s.flows.find(f=>f.id==='special-review').enabled=false;p=policyFor(s,'R-COM-012');assert.throws(()=>run(s,p.id,'save_policy',{policy:p}),/有效接收人/);s=ingestDetection(s,event(s),now);assert.equal(s.findings[0].workflow.flowId,'default');assert.ok(s.logs.some(l=>l.action==='流程兜底通知'&&l.recipients.includes('S01')));
});
test('D09: untreated alerts stay pending; manual detection completion requires ended call and explanation',()=>{
 let s=fresh();s=ingestDetection(s,event(s),now);assert.equal(s.alerts[0].status,'pending');s=run(s,s.findings[0].id,'dismiss',{value:'false_positive',note:'核对上下文确认误报',evidence:[0]});assert.equal(s.alerts[0].status,'open');assert.equal(detectionComplete(s,s.calls[0].id),false);assert.throws(()=>run(s,s.calls[0].id,'confirm_detection',{note:''}),/依据/);s=run(s,s.calls[0].id,'confirm_detection',{note:'人工回听全部录音并核对所有检查项'});assert.equal(s.alerts[0].status,'closed');assert.equal(detectionComplete(s,s.calls[0].id),true);assert.equal(s.calls[0].batches[0].checks[0].state,'running');
});
test('D12: notification dedup does not drop new problem tasks; interval permits later reminders',()=>{
 let s=fresh();const p=policyFor(s,'R-COM-012');s=run(s,p.id,'save_policy',{policy:{...p,reminderIntervalSeconds:60,recipients:['inspector']}});s=ingestDetection(s,event(s),now);const count=s.notificationDeliveries.length;assert.equal(count,2);s=ingestDetection(s,event(s,'R-COM-012','another-problem'),new Date(now.getTime()+30000));assert.equal(s.notificationDeliveries.length,count);assert.equal(s.logs.filter(l=>l.action==='新问题待办').length,2);s=ingestDetection(s,event(s),new Date(now.getTime()+61000));assert.equal(s.notificationDeliveries.length,count*2);
});
test('D12: in-progress routing and recipient snapshots survive policy changes; flow conflict recorded',()=>{
 let s=fresh();s=ingestDetection(s,event(s),now);const p=policyFor(s,'R-COM-012');s=run(s,p.id,'save_policy',{policy:{...p,recipients:['agent'],flowId:'special-review'}});s=ingestDetection(s,event(s),new Date(now.getTime()+60000));assert.equal(s.findings[0].workflow.flowId,'default');assert.ok(s.findings[0].flowConflict);assert.ok(!s.notificationDeliveries.some(d=>d.recipient===s.calls[0].agentId));assert.equal(s.reviews.length,0);
});
test('All connected businesses stay eligible despite legacy detection settings; display settings only affect presentation',()=>{
 let s=fresh();const call=s.calls[0],prior=structuredClone(call.batches[0].rules),expected=captureRules(s,now.toISOString(),call).map(r=>r.ruleId);
 assert.ok(expected.length>0);
 Object.assign(s.settings,{businesses:['未接入业务'],realtimeLimitSeconds:1,postCallLimitSeconds:1,timeoutReminder:true});
 assert.deepEqual(captureRules(s,now.toISOString(),call).map(r=>r.ruleId),expected);
 s=ensureSystemSettings(s);
 for(const key of ['businesses','realtimeLimitSeconds','postCallLimitSeconds','timeoutReminder'])assert.equal(key in s.settings,false);
 s=run(s,s.settings.id,'save_settings',{settings:{...s.settings,displayFields:['agent'],businesses:[],timeoutReminder:true}});
 assert.deepEqual(captureRules(s,now.toISOString(),call).map(r=>r.ruleId),expected);
 assert.deepEqual(s.calls[0].batches[0].rules,prior);
 assert.deepEqual(s.settings.displayFields,['agent']);
 assert.equal('businesses' in s.settings,false);assert.equal('timeoutReminder' in s.settings,false);
 assert.ok(s.logs.at(-1).changes.some(c=>c.field==='displayFields'));
 const p=policyFor(s,'R-COM-012');s=run(s,p.id,'delete_policy');s=run(s,s.rules[0].id,'create_policy',{policy:{...p,name:'新策略'}});assert.ok(!s.logs.at(-1).changes.some(c=>c.field==='resourceId'));assert.ok(s.logs.at(-1).changes.some(c=>c.field==='name'&&c.before===null&&c.after==='新策略'));
});
test('D06: delayed detection closure retains last active level after all problems completed',()=>{
 let s=fresh();s=ingestDetection(s,event(s),now);const p=policyFor(s,'R-COM-012');s=run(s,p.id,'save_policy',{policy:{...p,level:'low'}});s=run(s,s.findings[0].id,'dismiss',{value:'false_positive',note:'核实后判定误报',evidence:[0]});assert.equal(s.alerts[0].status,'open');assert.equal(s.alerts[0].level,'none');s.calls[0].batches[0].checks[0].state='success';s=reconcileAlerts(s,now);assert.equal(s.alerts[0].closingLevel,'low');assert.equal(s.alerts[0].highestLevel,'high');
});

test('Notification roles: retired group configuration is removed while historical recipients remain stable',()=>{
 let s=fresh();const p=policyFor(s,'R-COM-012');
 s=run(s,p.id,'save_policy',{policy:{...p,recipients:['inspector'],reminderIntervalSeconds:60}});
 s=ingestDetection(s,event(s),now);
 assert.deepEqual(s.notificationDeliveries.map(d=>d.recipient).sort(),['Q01','Q02']);
 const originalFlow=structuredClone(s.findings[0].workflow);
 s.inspectorGroups=[{id:'legacy-team',name:'旧组',memberIds:['Q01']}];
 s.policies[0].inspectorGroupIds=['legacy-team'];
 const oldPolicy=s.findings[0].hits[0].policy;
 oldPolicy.inspectorGroupIds=['legacy-team'];delete oldPolicy.inspectorIds;
 ensureSystemSettings(s);
 assert.ok(!('inspectorGroups' in s));assert.ok(s.policies.every(p=>!('inspectorGroupIds' in p)));
 assert.ok(!('inspectorGroupIds' in oldPolicy));assert.deepEqual(oldPolicy.inspectorIds,['Q01']);
 assert.deepEqual(s.findings[0].workflow,originalFlow);
 const before=s.notificationDeliveries.length;
 s=ingestDetection(s,event(s),new Date(now.getTime()+61000));
 assert.deepEqual(s.notificationDeliveries.slice(before).map(d=>d.recipient),['Q01']);
 s=ingestDetection(s,event(s,'R-COM-012','new-role-based-problem'),new Date(now.getTime()+122000));
 assert.deepEqual(s.findings.at(-1).hits[0].policy.inspectorIds,['Q01','Q02']);
 assert.ok(!('inspectorGroupIds' in s.findings.at(-1).hits[0].policy));
});

test('Inspector-first flow distributes new work by open workload and notifies its actual owner',()=>{
 let s=fresh();const p=policyFor(s,'R-COM-012');
 s=run(s,p.id,'save_policy',{policy:{...p,flowId:'special-review',recipients:['supervisor']}});
 // A stored legacy owner must not pin automatic routing to one person.
 s.flows.find(f=>f.id==='special-review').owner='Q02';
 for(const key of ['auto-1','auto-2','auto-3'])s=ingestDetection(s,event(s,'R-COM-012',key),now);
 assert.deepEqual(s.reviews.map(r=>r.owner),['Q01','Q02','Q01']);
 for(const r of s.reviews){assert.deepEqual(s.logs.find(l=>l.action==='新问题待办'&&l.target===r.findingIds[0]).recipients,[r.owner]);assert.ok(s.calls[0].authorized.includes(r.owner));}
 const owners=s.reviews.map(r=>r.owner);
 s=ingestDetection(s,event(s,'R-COM-012','auto-1'),new Date(now.getTime()+61000));
 assert.deepEqual(s.reviews.map(r=>r.owner),owners);
 assert.equal(s.reviews.length,3);
});
