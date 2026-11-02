import {legacyIssued} from './helpers/legacy-issuance.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitial} from '../lib/fixtures.ts';
import {apply,entity,actions,notices,isTodo,agentWorkItems,restoreLifecycle,acceptanceDraftMatches} from '../lib/workflow.ts';
const now=new Date('2026-09-13T10:00:00+08:00'),due='2026-09-17T12:00:00+08:00';
let seq=0;
const as=(s,identity)=>({...s,identity});
const run=(s,id,action,input={})=>apply(s,{id,action,rev:entity(s,id).rev,requestId:`life-${++seq}`,input:{note:'核对本轮材料及完整事实依据',owner:'Q01',dueAt:due,evidence:[2],...input}},now);
function verification(count=2){let s=legacyIssued(now,due,count),id=s.remedies.at(-1).id;s=run(as(s,'A1048'),id,'accept_remedy');s=run(s,id,'sample_calls');s=run(s,id,'material',{samples:[s.calls.at(-1).id]});return [as(s,'Q01'),id];}
for(const outcome of ['false_positive','insufficient']) for(const stage of ['pending','submitted']) test(`N01: ${outcome} cancels ${stage} remedy supplements and rejects stale replies`,()=>{
  let[s,id]=verification();s=run(s,id,'verify',{value:'insufficient'});const sp=s.supplements.at(-1).id;
  if(stage==='submitted')s=run(as(s,'A1048'),sp,'reply',{attachment:'补充材料'});
  const original=structuredClone(entity(s,sp));
  s=run(as(s,'A1048'),entity(s,id).findingId,'appeal');const ap=s.appeals.at(-1).id;
  s=run(as(s,'S01'),ap,'accept_decide',{value:outcome,owner:''});
  assert.equal(entity(s,id).status,'terminated');assert.equal(entity(s,sp).status,'cancelled');
  assert.equal(entity(s,sp).reply,original.reply);assert.ok(entity(s,sp).cancellationReason);
  for(const actor of ['A1048','Q01','S01']){const a=as(s,actor);assert.ok(!isTodo(a,entity(a,id)));assert.deepEqual(actions(a,sp),[]);assert.ok(!notices(a).some(x=>x.id===id));}
  assert.throws(()=>run(as(s,'A1048'),sp,'reply',{attachment:'旧页面尝试补充'}),/不允许/);
});
test('N01: maintaining an appeal resumes the original supplement without deleting work',()=>{
 let[s,id]=verification();s=run(s,id,'verify',{value:'insufficient'});const sp=s.supplements.at(-1).id;
 s=run(as(s,'A1048'),entity(s,id).findingId,'appeal');s=run(as(s,'S01'),s.appeals.at(-1).id,'accept_decide',{value:'maintain'});
 assert.equal(entity(s,sp).status,'pending');assert.ok(isTodo(as(s,'A1048'),entity(s,id)));assert.ok(actions(as(s,'A1048'),sp).includes('reply'));
});
test('N01: stored legacy terminal parents repair dangling children idempotently',()=>{
 let[s,id]=verification();s=run(s,id,'verify',{value:'insufficient'});const r=entity(s,id),sp=s.supplements.at(-1);r.status='terminated';r.terminationReason='旧版本已终止';r.finishedAt=now.toISOString();
 assert.deepEqual(actions(as(s,'A1048'),sp.id),[]);assert.ok(!isTodo(as(s,'A1048'),r));
 const fixed=restoreLifecycle(structuredClone(s));assert.equal(entity(fixed,sp.id).status,'cancelled');assert.equal(entity(fixed,sp.id).note,sp.note);assert.deepEqual(restoreLifecycle(structuredClone(fixed)),fixed);
});
test('N02: supplement handoff has exactly one active task, then restores the assigned review',()=>{
 let s=run(createInitial(now),'AP-1033','accept_assign',{owner:'Q02'});const rid=entity(s,'AP-1033').reviewId;
 s=run(as(s,'Q02'),rid,'supplement',{owner:'A1048'});const sp=s.supplements.at(-1).id;
 assert.ok(!isTodo(s,entity(s,rid)));assert.ok(!isTodo(s,entity(s,'AP-1033')));assert.ok(isTodo(as(s,'A1048'),entity(s,'AP-1033')));
 s=run(as(s,'A1048'),sp,'reply');s=as(s,'Q02');assert.ok(isTodo(s,entity(s,'AP-1033')));assert.ok(!isTodo(s,entity(s,rid)));assert.deepEqual(actions(s,sp),['receive_supplement']);
 s=run(s,sp,'receive_supplement');assert.ok(isTodo(as(s,'Q02'),entity(s,rid)));assert.ok(!isTodo(s,entity(s,'AP-1033')));assert.equal(entity(s,rid).owner,'Q02');
});
test('N03: live reminders share the agent queue and notice source while read and feedback stay independent',()=>{
 let s=as(run(createInitial(now),'F-1041','remind'),'A1048');assert.ok(agentWorkItems(s).some(x=>x.id==='F-1041'));assert.ok(notices(s).some(x=>x.id==='F-1041'));
 s=run(s,'F-1041','read_reminder');assert.ok(!isTodo(s,entity(s,'F-1041')));assert.ok(agentWorkItems(s).some(x=>x.id==='F-1041'));assert.ok(actions(s,'F-1041').includes('feedback_reminder'));
 s=run(s,'F-1041','feedback_reminder');assert.ok(entity(s,'F-1041').reminder.feedback);assert.equal(entity(s,'F-1041').conclusions.length,0);assert.ok(!agentWorkItems(as(s,'A1186')).some(x=>x.id==='F-1041'));
});
test('N04: saved acceptance restores result, reason and basis after serialization; submission archives it',()=>{
 let[s,id]=verification(1);s=run(s,id,'save_acceptance',{value:'fail',note:'第一段说明尚未符合验收标准'});s=JSON.parse(JSON.stringify(s));
 const r=entity(s,id);assert.equal(r.acceptanceDraft.result,'fail');assert.equal(r.acceptanceDraft.note,'第一段说明尚未符合验收标准');assert.equal(r.acceptanceDraft.round,1);assert.ok(acceptanceDraftMatches(r,'Q01'));assert.equal(r.status,'verification');
 s=run(s,id,'verify',{value:r.acceptanceDraft.result,note:r.acceptanceDraft.note});assert.equal(entity(s,id).acceptanceDraft,undefined);assert.equal(entity(s,id).acceptanceDraftHistory.length,1);assert.equal(entity(s,id).rounds.at(-1).acceptance.result,'fail');
});
test('N04: changed standard preserves reference draft, requires confirmation and archives old basis',()=>{
 let[s,id]=verification(1);s=run(s,id,'save_acceptance',{value:'pass',note:'已完成原验收标准核对'});s=run(as(s,'S01'),id,'change_standard',{goal:'补充业务条件说明',standard:'明确说明处理时效及例外'});s=as(s,'Q01');
 assert.equal(entity(s,id).acceptanceDraft.sequence,1);assert.ok(!acceptanceDraftMatches(entity(s,id),'Q01'));assert.throws(()=>run(s,id,'verify',{value:'pass'}),/已变化/);
 s=run(s,id,'save_acceptance',{value:'pass',draftBasisConfirmed:true,note:'已核对新标准与本轮样例'});assert.equal(entity(s,id).acceptanceDraft.sequence,2);assert.equal(entity(s,id).acceptanceDraftHistory[0].sequence,1);
});
test('N04: legacy drafts and reassigned drafts require explicit review, and old inspector loses write access',()=>{
 let[s,id]=verification(1);entity(s,id).draft='旧版本遗留的验收文字';assert.throws(()=>run(s,id,'save_acceptance'),/已变化/);
 s=run(s,id,'save_acceptance',{value:'pass',draftBasisConfirmed:true});assert.equal(entity(s,id).acceptanceDraftHistory[0].sequence,0);
 s=run(as(s,'S01'),id,'reassign',{owner:'Q02'});assert.throws(()=>run(as(s,'Q01'),id,'save_acceptance'),/不允许/);assert.ok(!acceptanceDraftMatches(entity(s,id),'Q02'));assert.throws(()=>run(as(s,'Q02'),id,'verify',{value:'pass'}),/已变化/);
});
test('N04: appeal pause permits draft updates but never formal acceptance',()=>{
 let[s,id]=verification(1);s=run(as(s,'A1048'),entity(s,id).findingId,'appeal');s=as(s,'Q01');s=run(s,id,'save_acceptance',{value:'pass'});assert.ok(entity(s,id).acceptanceDraft);assert.ok(!actions(s,id).includes('verify'));assert.throws(()=>run(s,id,'verify',{value:'pass'}),/不允许/);
});
