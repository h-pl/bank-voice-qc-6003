import test from 'node:test';
import assert from 'node:assert/strict';
import {lifecycleLabel} from '../lib/lifecycle-labels.ts';
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {actions,currentOwner,contextActions,primaryAction,actionLabel,entity,apply,canSee,people} from '../lib/workflow.ts';
const now=new Date('2026-09-23T00:00:00Z');
const seed=()=>createPrototypeState(now);
const as=(s,identity)=>({...s,identity});
const row=(s,id)=>s.seedScenarios.find(x=>x.id===`CTX-${id}`);
let n=0;
const run=(s,id,action,input={})=>apply(s,{id,action,rev:entity(s,id).rev,requestId:`context-test-${++n}`,input:{note:'已核对本次业务记录及完整上下文',dueAt:'2026-09-26T00:00:00Z',...input}},now);
const sorted=x=>[...x].sort();

test('supervisor confirmation shows only the correct decisions, without unrelated management routes',()=>{
 const s=seed();
 for(const id of ['WO-1039','WO-SPOT-2',row(s,'REVIEW-FP').reviewId])assert.deepEqual(sorted(contextActions(s,id)),['publish','return_review']);
 assert.equal(actionLabel(s,row(s,'REVIEW-FP').reviewId,'publish'),'确认结果并归档');
 for(const id of ['AP-AP-DECISION',row(s,'AP-UPHELD').appealId,row(s,'AP-EXPLAIN').appealId])assert.deepEqual(sorted(contextActions(s,id)),['decide','return_appeal']);
 assert.deepEqual(sorted(contextActions(s,'REC-UI-3')),['close_remedy','return_remedy']);
 assert.deepEqual(sorted(contextActions(s,row(s,'EVIDENCE-REQUEST').reviewId)),['return_review','supplement']);
});
test('every exposed action is authorized, unique and labelable for all seeded entities and five identities',()=>{
 const s=seed();for(const person of people){const state=as(s,person.id);for(const item of [...s.calls,...s.findings,...s.reviews,...s.appeals,...s.remedies,...s.supplements,...s.rules,...s.resources]){
  const exposed=contextActions(state,item.id);assert.equal(new Set(exposed).size,exposed.length);
  for(const action of exposed){assert.ok(actions(state,item.id).includes(action));assert.ok(actionLabel(state,item.id,action));assert.ok(canSee(state,item.id));}
  if(primaryAction(state,item.id))assert.ok(exposed.includes(primaryAction(state,item.id)));
 }}
});
test('supplement buttons follow the actual recipient and restore the original review',()=>{
 let s=seed();const review=row(s,'EVIDENCE-SUBMITTED').reviewId;const sp=s.supplements.find(x=>x.target===review&&x.status==='submitted');
 assert.deepEqual(contextActions(as(s,'S01'),sp.id),['receive_supplement']);assert.deepEqual(contextActions(as(s,'Q01'),sp.id),[]);
 s=run(s,sp.id,'receive_supplement');assert.equal(entity(s,review).status,'working');assert.ok(contextActions(as(s,'Q01'),review).includes('submit_review'));
 const ap=row(s,'AP-SUBMITTED');assert.equal(lifecycleLabel(entity(s,ap.appealId),s),'待质检员接收补件');assert.equal(currentOwner(s,entity(s,ap.reviewId)),'Q02');const asp=s.supplements.find(x=>x.target===ap.appealId&&x.status==='submitted');
 assert.deepEqual(contextActions(s,asp.id),[]);assert.deepEqual(contextActions(as(s,'Q02'),asp.id),['receive_supplement']);
 s=run(as(s,'Q02'),asp.id,'receive_supplement');assert.ok(contextActions(s,ap.reviewId).includes('submit_review'));
});
test('return routes expose agreement or explanation to the assigned inspector, and a replacement must investigate again',()=>{
 let s=seed();assert.deepEqual(sorted(contextActions(as(s,'Q02'),'WO-AP-UI-7')),['agree_appeal_return','explain_appeal']);
 assert.deepEqual(sorted(contextActions(as(s,'Q02'),'REC-REC-RESPONSE')),['agree_remedy_return','explain_remedy']);
 assert.throws(()=>run(s,'WO-AP-UI-7','reassign',{owner:'Q02'}),/另一位/);
 s=run(s,'WO-AP-UI-7','reassign',{owner:'Q01',dueAt:undefined});assert.equal(entity(s,'WO-AP-UI-7').status,'working');assert.ok(!contextActions(as(s,'Q01'),'WO-AP-UI-7').includes('explain_appeal'));
});
test('new-flow material shortages return to the agent and distributed/archived findings cannot restart via follow-up',()=>{
 const s=seed();assert.throws(()=>run(as(s,'Q02'),'REC-UI-2','verify',{value:'insufficient'}),/不满足/);
 assert.ok(!contextActions(s,'F-1034').includes('followup'));assert.ok(!contextActions(s,'F-SPOT-5').includes('followup'));
 assert.ok(!actions(as(s,'A1048'),'REC-UI-2').includes('sample_calls'));
 assert.ok(actions(as(s,entity(s,'REC-REC-FAIL').agentId),'REC-REC-FAIL').includes('sample_calls'));
 const live=row(s,'LIVE-DRAFT');assert.ok(actions(as(s,'Q01'),live.reviewId).includes('save_review'));assert.ok(!actions(as(s,'Q01'),live.reviewId).includes('submit_review'));
});
test('the new upheld appeal can be confirmed and cancels the finding without creating a remedy',()=>{
 let s=seed();const r=row(s,'AP-UPHELD'),f=entity(s,r.findingId);assert.equal(entity(s,r.reviewId).opinions[f.id].value,'false_positive');
 s=run(s,r.appealId,'decide',{value:'false_positive',evidence:f.evidence});assert.equal(entity(s,r.appealId).status,'done');assert.equal(entity(s,f.id).status,'closed');assert.ok(!s.remedies.some(x=>x.findingId===f.id));
});
test('new resubmitted remedy has a complete prior round and can proceed through verification and archive',()=>{
 let s=seed();const r=row(s,'REC-RETRY');const remedy=entity(s,r.remedyId);assert.equal(remedy.round,2);assert.equal(remedy.rounds[0].acceptance.result,'fail');assert.ok(remedy.materials.length);
 s=run(as(s,remedy.inspector),remedy.id,'verify',{value:'pass'});s=run(as(s,'S01'),remedy.id,'close_remedy');assert.equal(entity(s,remedy.id).status,'done');
});
test('warning triage has exactly three routes for live and ended calls; evidence requests belong to review',()=>{
 const s=seed();
 for(const id of ['F-1041','F-1031','F-1030']){
  assert.deepEqual(sorted(contextActions(s,id)),['assign','dismiss','dispatch']);
  assert.ok(!actions(s,id).includes('supplement'));
  assert.throws(()=>run(s,id,'supplement',{owner:'A1048'}),/不允许/);
 }
 const warning=entity(s,'F-1031');warning.alertTiming={...warning.alertTiming,triggeredAt:now.toISOString(),resolutionDueAt:new Date(+now+8*3600000).toISOString()};
 let next=run(s,'F-1031','assign',{owner:'Q01',dueAt:new Date(+now+3600000).toISOString()});const id=next.reviews.at(-1).id;
 next=run(as(next,'Q01'),id,'request_evidence');
 assert.ok(contextActions(as(next,'S01'),id).includes('supplement'));
 next=run(as(next,'S01'),id,'supplement',{owner:'A1048',dueAt:new Date(+now+1800000).toISOString()});
 assert.equal(next.supplements.at(-1).target,id);
});
