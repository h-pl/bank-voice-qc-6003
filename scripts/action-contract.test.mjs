import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {contextActions,entity,apply,canSee,linkableFindings,primaryAction,people} from '../lib/workflow.ts';
const now=new Date('2026-09-23T00:00:00Z'),due='2026-09-27T00:00:00Z';
const seed=()=>createPrototypeState(now),as=(s,identity)=>({...s,identity});
let sequence=0;
const run=(s,id,action,input={})=>apply(s,{id,action,rev:entity(s,id).rev,requestId:`audit-${++sequence}`,input:{note:'核对完整业务依据与本轮处理要求',dueAt:due,...input}},now);
const ctx=(s,key)=>s.seedScenarios.find(x=>x.id===`CTX-${key}`);
// Expected routes are prescribed by the three confirmed flowcharts and PRD 7.3–7.7.
// They are deliberately literal, not generated from actions().
const cases=[
 ['S01','F-1041',['dispatch','dismiss','assign']],
 ['S01','F-1031',['dispatch','dismiss','assign']],
 ['S01','F-1037',['optimization_feedback']],
 ['S01','WO-1038',['extend','reassign']],
 ['Q01','WO-1038',['submit_review','request_evidence']],
 ['Q02','WO-1038',[]],
 ['A1048','WO-1038',[]],
 ['S01','WO-1039',['publish','return_review']],
 ['Q01','WO-1039',[]],
 ['S01','WO-SPOT-2',['publish','return_review']],
 ['Q02','WO-SPOT-1',['submit_review','request_evidence','add_finding']],
 ['S01','WO-SPOT-3',[]],
 ['Q02','WO-SPOT-3',[]],
 ['S01','AP-1033',['accept_assign','extend']],
 ['A1048','AP-1033',['withdraw']],
 ['S01','AP-AP-DECISION',['decide','return_appeal']],
 ['Q02','AP-AP-DECISION',[]],
 ['S01','AP-AP-SUPPLEMENT',['extend']],
 ['Q02','WO-AP-AP-SUPPLEMENT',[]],
 ['A1048','AP-AP-SUPPLEMENT',['withdraw']],
 ['Q02','WO-AP-UI-7',['agree_appeal_return','explain_appeal']],
 ['S01','REC-1036',['change_standard','extend','assign_inspector']],
 ['A1048','REC-1036',['adjust_request','material']],
 ['S01','REC-UI-1',['change_standard','extend','assign_inspector']],
 ['A1048','REC-UI-1',[]],
 ['Q02','REC-UI-2',['verify']],
 ['Q01','REC-UI-2',[]],
 ['S01','REC-UI-3',['close_remedy','return_remedy']],
 ['A1048','REC-UI-3',[]],
 ['Q02','REC-REC-RESPONSE',['agree_remedy_return','explain_remedy']],
 ['S01','REC-REC-RESPONSE',[]],
 ['A1186','REC-REC-RESPONSE',[]],
 ['S01','REC-UI-8',[]],
 ['A1186','REC-UI-8',[]],
 ['Q02','REC-UI-8',[]],
 ['A1048','F-1032',['accept_result','ack','appeal','request_distribution_extension']],
 ['A1048','F-1037',['ack']],
 ['A1048','F-1036',[]],
 ['A1186','F-1032',[]],
];
for(const [identity,id,expected] of cases)test(`flow exit contract: ${identity} / ${id}`,()=>{
 assert.deepEqual(contextActions(as(seed(),identity),id).sort(),[...expected].sort());
});
test('supplement and withdrawal have no alternate entry that bypasses the current receiver',()=>{
 let s=seed();const row=ctx(s,'AP-SUBMITTED'),sp=s.supplements.find(x=>x.target===row.appealId&&x.status==='submitted');
 for(const p of people) assert.deepEqual(contextActions(as(s,p.id),sp.id),p.id==='Q02'?['receive_supplement']:[]);
 assert.deepEqual(contextActions(as(s,'Q02'),row.reviewId),[]);
 assert.throws(()=>run(as(s,'Q02'),row.reviewId,'submit_review'),/不允许/);
 s=run(as(s,'A1048'),row.appealId,'withdraw');
 for(const p of people)for(const id of [row.appealId,row.reviewId,sp.id])assert.deepEqual(contextActions(as(s,p.id),id),[]);
 assert.deepEqual(contextActions(as(s,'A1048'),row.findingId).sort(),['accept_result','appeal','request_distribution_extension']);
});
test('later assigned and replacement inspectors can open submitted sample calls from material links',()=>{
 let s=seed(),id='REC-UI-1';const samples=entity(s,id).materials.flatMap(m=>m.samples);
 assert.ok(samples.length);
 s=run(s,id,'assign_inspector',{owner:'Q01'});
 for(const sample of samples)assert.ok(canSee(as(s,'Q01'),sample),sample);
 s=run(s,id,'reassign',{owner:'Q02'});
 for(const sample of samples)assert.ok(canSee(as(s,'Q02'),sample),sample);
 assert.deepEqual(contextActions(as(s,'Q01'),id),[]);
 assert.deepEqual(contextActions(as(s,'Q02'),id),['verify']);
});
test('spotcheck links only unresolved candidate facts and cannot reopen a final conclusion',()=>{
 let s=seed();const row=ctx(s,'SPOT-LINK');s=as(s,'Q01');
 assert.deepEqual(linkableFindings(s,entity(s,row.reviewId)).map(f=>f.id),[row.findingId]);
 assert.ok(contextActions(s,row.reviewId).includes('link_finding'));
 s=run(s,row.reviewId,'link_finding',{findingId:row.findingId});
 assert.equal(entity(s,row.findingId).status,'review');assert.ok(!contextActions(s,row.reviewId).includes('link_finding'));
 let closed=seed();const f=entity(closed,'F-1037');closed=run(closed,f.callId,'spotcheck',{owner:'Q01',scope:'补充抽检已有通话'});const id=closed.reviews.at(-1).id;
 assert.ok(!linkableFindings(as(closed,'Q01'),entity(closed,id)).some(x=>x.id===f.id));
 assert.throws(()=>run(as(closed,'Q01'),id,'link_finding',{findingId:f.id}),/不允许|不能重新关联/);
});
test('returned review exposes the actual reason; adjustment request prioritizes its resolution',()=>{
 const base=seed();for(const id of entity(base,'WO-1039').findingIds){const f=entity(base,id);if(f.alertTiming)f.alertTiming={...f.alertTiming,triggeredAt:now.toISOString(),resolutionDueAt:new Date(+now+8*3600000).toISOString()};}
 const s=run(base,'WO-1039','return_review',{note:'请核对业务时限说明与受理记录',dueAt:new Date(+now+3600000).toISOString()});
 assert.equal(entity(s,'WO-1039').supervisorComment,'请核对业务时限说明与受理记录');
 const row=ctx(s,'REC-ADJUST');assert.equal(primaryAction(s,row.remedyId),'change_standard');
});
