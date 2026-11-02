import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {apply,actions,entity} from '../lib/workflow.ts';
import {captureRules,policyFor} from '../lib/configuration.ts';
import {ingestDetection,reconcileAlerts,problemFinished} from '../lib/call-alerts.ts';
import {report} from '../lib/reports.ts';
import {supportsWarning} from '../lib/strategy-schema.ts';
const now=new Date('2026-10-31T08:00:00Z');
const run=(s,id,action,input={})=>apply(s,{id,rev:entity(s,id).rev,action,requestId:crypto.randomUUID(),input},now);
function fresh(){const s=createPrototypeState(now);s.calls=[s.calls[0]];const c=s.calls[0];c.endedAt=now.toISOString();c.batches=[{id:'B-new',startedAt:now.toISOString(),rules:captureRules(s,now.toISOString()),checks:[{name:'检测',state:'running'}]}];s.findings=[];s.reviews=[];s.appeals=[];s.remedies=[];s.supplements=[];s.alerts=[];s.logs=[];return s;}
function event(s,ruleId='R-COM-012',key=crypto.randomUUID(),problemKey=key){const c=s.calls[0],rule=s.rules.find(r=>r.id===ruleId),condition=rule.conditions[0];return {key,problemKey,callId:c.id,batchId:'B-new',ruleId,feature:condition.feature,role:condition.role,stage:'全程',count:10,duration:30,atSecond:20,evidence:[0],title:'核对发现的问题'};}
test('6003: twelve indicators, resources and rules are one-to-one; configuration exposes direct operations',()=>{
 const s=createPrototypeState(now);assert.equal(s.rules.length,12);assert.equal(s.resources.length,12);assert.equal(new Set(s.rules.map(r=>r.resourceId)).size,12);
 for(const r of s.rules){assert.ok(s.resources.some(x=>x.id===r.resourceId&&x.indicator===r.indicator));assert.ok(!('versions' in r));assert.deepEqual(actions(s,r.id),supportsWarning(r.indicator)?['toggle_indicator','create_policy','save_rule_conditions']:['toggle_indicator','create_policy']);}
 for(const r of s.resources){assert.deepEqual(actions(s,r.id),['save_resource']);assert.ok(!('versions'in r));}
 assert.ok(s.resources.find(r=>r.kind==='professional').knowledge);assert.ok(s.rules.find(r=>r.resourceId==='RES-EXPRESSION').conditions.length===4);
});
test('6003: disabled indicator is excluded from subsequent batches, in-flight basis retained',()=>{
 let s=fresh();const old=structuredClone(s.calls[0].batches[0].rules);s=run(s,'R-COM-012','toggle_indicator');assert.equal(captureRules(s,now.toISOString()).some(r=>r.ruleId==='R-COM-012'),false);assert.deepEqual(s.calls[0].batches[0].rules,old);s=ingestDetection(s,event(s),now);assert.equal(s.findings.length,1);s=JSON.parse(JSON.stringify(s));assert.equal(s.rules.find(r=>r.id==='R-COM-012').enabled,false);
});
test('6003: resource update is atomic, rejects stale/invalid writes, retains captured evidence',()=>{
 let s=fresh();s=ingestDetection(s,event(s),now);const basis=structuredClone(s.findings[0].basis),r=s.resources.find(r=>r.kind==='privacy');
 const changed=r.content.replace('禁止索取验证码','验证码安全要求');s=run(s,r.id,'save_resource',{content:changed});assert.equal(s.resources.find(x=>x.id===r.id).content,changed);assert.deepEqual(s.findings[0].basis,basis);
 assert.throws(()=>apply(s,{id:r.id,rev:r.rev,action:'save_resource',requestId:'stale',input:{content:changed}},now),/已更新/);
 assert.throws(()=>run(s,r.id,'save_resource',{content:'错误,表头'}),/表头/);assert.equal(s.resources.find(x=>x.id===r.id).content,changed);
 assert.throws(()=>run({...s,identity:'Q01'},r.id,'save_resource',{content:changed}),/仅主管/);
});
test('6003: exclusive strategy ownership, shared strategy, deletion falls back to defaults',()=>{
 let s=fresh();const p=s.policies[0];assert.ok(p.ruleIds.length>1);
 assert.throws(()=>run(s,s.rules[0].id,'create_policy',{policy:{...p,name:'另一策略'}}),/占用/);
 s=run(s,p.id,'delete_policy');assert.equal(policyFor(s,p.ruleIds[0]),undefined);s=ingestDetection(s,event(s,p.ruleIds[0]),now);assert.equal(s.findings[0].severity,s.defaults.level);assert.equal(s.findings[0].workflow.flowId,'default');
});
test('6003: repeated callbacks and evidence append create one problem; three risks do not compound or reroute',()=>{
 let s=fresh();const e=event(s);s=ingestDetection(s,e,now);assert.equal(ingestDetection(s,e,now),s);s=ingestDetection(s,{...e,key:'second',evidence:[1]},now);assert.equal(s.findings.length,1);assert.deepEqual(s.findings[0].evidence,[0,1]);
 for(const id of ['R-BAN-001','R-SVC-009'])s=ingestDetection(s,event(s,id),now);
 assert.equal(s.findings.length,3);assert.equal(s.alerts.length,1);assert.equal(s.reviews.length,1);assert.equal(s.findings.find(f=>f.ruleId==='R-SVC-009').status,'review');assert.ok(s.findings.filter(f=>f.ruleId!=='R-SVC-009').every(f=>f.status==='candidate'));assert.equal(s.alerts[0].level,'high');
});
test('6003: special workflow assigns a real review; invalid route falls back with reason',()=>{
 let s=fresh(),p=policyFor(s,'R-COM-012');s=run(s,p.id,'save_policy',{policy:{...p,flowId:'special-review'}});s=ingestDetection(s,event(s),now);assert.equal(s.reviews.length,1);assert.equal(s.reviews[0].owner,'Q01');assert.equal(s.findings[0].status,'review');
 s.flows.find(f=>f.id==='special-review').enabled=false;s=ingestDetection(s,event(s),now);assert.equal(s.findings[1].status,'candidate');assert.match(s.findings[1].workflow.reason,/回到默认/);
});
test('6003: dynamic level decreases and increases without extending existing deadlines',()=>{
 let s=fresh();s=ingestDetection(s,event(s),now);const p=policyFor(s,'R-COM-012'),before=s.findings[0].alertTiming.triageDueAt;
 s=run(s,p.id,'save_policy',{policy:{...p,level:'low'}});assert.equal(s.alerts[0].level,'low');assert.equal(s.findings[0].alertTiming.triageDueAt,before);
 const current=policyFor(s,'R-COM-012');s=run(s,current.id,'save_policy',{policy:{...current,level:'high'}});assert.equal(s.alerts[0].level,'high');assert.ok(s.alerts[0].history.some(h=>h.to.endsWith('/low')));
});
test('6003: partial closure, detection barrier, complete closure and new-problem reopen keep alert identity',()=>{
 let s=fresh();s=ingestDetection(s,event(s),now);s=ingestDetection(s,event(s),now);const aid=s.alerts[0].id;
 s=run(s,s.findings[0].id,'dismiss',{value:'false_positive',note:'核对上下文属于保护性提醒',evidence:[0]});assert.equal(s.alerts[0].status,'open');assert.equal(s.alerts[0].completed,1);
 s=run(s,s.findings[1].id,'dismiss',{value:'false_positive',note:'核对上下文属于保护性提醒',evidence:[0]});assert.equal(s.alerts[0].status,'open');s.calls[0].batches[0].checks[0].state='success';s=reconcileAlerts(s,now);assert.equal(s.alerts[0].status,'closed');
 s=ingestDetection(s,event(s),now);assert.equal(s.alerts[0].id,aid);assert.equal(s.alerts.length,1);assert.equal(s.alerts[0].status,'open');assert.equal(problemFinished(s,s.findings[0]),true);
});
test('6003: report alert totals reconcile with live aggregation while issues retain independent counts',()=>{
 let s=fresh();s=ingestDetection(s,event(s),now);s=ingestDetection(s,event(s),now);const m=report(s,{start:'',end:'',business:'',group:'',agent:''},now);const get=k=>m.find(x=>x.key===k);
 assert.equal(get('alerts').value,'1');assert.equal(get('candidates').value,'2');assert.equal(get('alerts-pending').rows.length+get('alerts-open').rows.length+get('alerts-closed').rows.length,1);assert.equal(['high','medium','low','none'].reduce((n,l)=>n+get(`alert-${l}`).rows.length,0),1);
});
