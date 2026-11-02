import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitial} from '../lib/fixtures.ts';
import {apply,actions,actionLabel,primaryAction,entity,latest,callFor,currentOwner,isTodo,restoreLifecycle} from '../lib/workflow.ts';
const now=new Date('2026-09-22T10:00:00+08:00'),due='2026-09-26T10:00:00+08:00';
const requirements={goal:'完整说明业务条件',standard:'逐项说明时限与处理路径',sampleCount:1,observation:'提交同业务整改后样例',dueAt:due};
let seq=0;
const as=(s,identity)=>({...s,identity});
const run=(s,id,action,input={})=>apply(s,{id,action,rev:entity(s,id).rev,requestId:`flow-${++seq}`,input:{note:'核对证据与本次处理要求',evidence:[2],owner:'Q02',dueAt:due,...input}},now);
const direct=()=>run(createInitial(now),'F-1037','dispatch',requirements);
const submitMaterial=(s,id)=>{s=run(s,id,'sample_calls');return run(s,id,'material',{samples:[s.calls.at(-1).id]});};
function accepted(){let s=direct();s=run(as(s,'A1048'),'F-1037','accept_result');return[s,s.remedies.at(-1).id];}
function appeal(){let s=run(as(direct(),'A1048'),'F-1037','appeal');const ap=s.appeals.at(-1).id;s=run(as(s,'S01'),ap,'accept_assign');return[s,ap,entity(s,ap).reviewId];}
const opinion=(value='risk')=>({'F-1037':{value,note:'结合原音与业务规则核查',evidence:[2]}});
test('F01: distribution is not rectification; read does not accept; acceptance is atomic and scoped',()=>{
 const s=direct(),n=s.remedies.length;assert.equal(s.remedies.length,n);assert.equal(entity(s,'F-1037').distribution.status,'pending');
 let a=run(as(s,'A1048'),'F-1037','ack');assert.ok(actions(a,'F-1037').includes('accept_result'));assert.ok(isTodo(a,entity(a,'F-1037')));
 assert.throws(()=>run(as(a,'A1186'),'F-1037','accept_result'),/不允许/);
 const cmd={id:'F-1037',rev:entity(a,'F-1037').rev,action:'accept_result',requestId:'accept-once',input:{}};
 a=apply(a,cmd,now);assert.equal(a.remedies.length,n+1);assert.equal(a.remedies.at(-1).status,'executing');assert.equal(a.remedies.at(-1).inspector,'');assert.equal(apply(a,cmd,now),a);assert.ok(!actions(a,'F-1037').includes('appeal'));
});
test('F02: direct acceptance allows materials before assignment, with parallel supervisor todo and no data or deadline reset',()=>{
 let[s,id]=accepted();const deadline=entity(s,id).dueAt;s=submitMaterial(s,id);const materials=structuredClone(entity(s,id).materials);
 assert.ok(isTodo(as(s,'S01'),entity(s,id)));assert.equal(currentOwner(s,entity(s,id)),'S01');assert.throws(()=>run(as(s,'Q01'),id,'verify',{value:'pass'}),/不允许/);
 s=run(as(s,'S01'),id,'assign_inspector',{owner:'Q02'});assert.equal(entity(s,'F-1037').distribution.inspector,'Q02');assert.equal(entity(s,id).dueAt,deadline);assert.deepEqual(entity(s,id).materials,materials);assert.equal(entity(s,id).status,'verification');assert.ok(actions(as(s,'Q02'),id).includes('verify'));assert.ok(!actions(s,id).includes('assign_inspector'));
 assert.deepEqual(restoreLifecycle(JSON.parse(JSON.stringify(s))).remedies,JSON.parse(JSON.stringify(s.remedies)));
});
test('F03: review confirmation inherits reviewer, needs binary conclusion and requirements, never immediately creates remedy',()=>{
 let s=createInitial(now),r=entity(s,'WO-1039');assert.throws(()=>run(s,r.id,'publish',requirements),/不允许/);
 const opinions=Object.fromEntries(r.findingIds.map(id=>[id,{value:'risk',note:'已核实存在相关问题',evidence:[2]}]));const n=s.remedies.length;
 s=run(s,r.id,'return_review');s=run(as(s,r.owner),r.id,'submit_review',{opinions});s=as(s,'S01');
 s=run(s,r.id,'publish',{...requirements,opinions,owner:'Q02'});assert.equal(s.remedies.length,n);
 s=run(as(s,'A1048'),r.findingIds[0],'accept_result');assert.equal(s.remedies.at(-1).inspector,'Q01');assert.ok(!actions(as(s,'S01'),s.remedies.at(-1).id).includes('assign_inspector'));
});
test('F04: verification fail goes to agent; supervisor return goes to inspector; disagreement returns explanation to supervisor',()=>{
 let[s,id]=accepted();s=run(as(s,'S01'),id,'assign_inspector');s=submitMaterial(as(s,'A1048'),id);s=run(as(s,'Q02'),id,'verify',{value:'pass'});
 s=run(as(s,'S01'),id,'return_remedy',{note:'请说明时效要求如何核实'});assert.equal(entity(s,id).status,'response');assert.equal(currentOwner(s,entity(s,id)),'Q02');assert.ok(!actions(as(s,'A1048'),id).includes('material'));
 const materials=structuredClone(entity(s,id).materials);s=run(as(s,'Q02'),id,'explain_remedy',{note:'第二段录音已完整说明时限'});assert.deepEqual(entity(s,id).materials,materials);assert.equal(entity(s,id).status,'supervisor');s=run(as(s,'S01'),id,'close_remedy');assert.equal(entity(s,id).status,'done');
});
test('F05: inspector agrees with supervisor and asks agent for specific missing items; direct QA failure uses same loop',()=>{
 let[s,id]=accepted();s=run(as(s,'S01'),id,'assign_inspector');s=submitMaterial(as(s,'A1048'),id);s=run(as(s,'Q02'),id,'verify',{value:'pass'});s=run(as(s,'S01'),id,'return_remedy');s=run(as(s,'Q02'),id,'agree_remedy_return',{note:'请增补办理时限说明及复测样例'});
 assert.equal(entity(s,id).status,'executing');assert.match(entity(s,id).supplementRequirements,/办理时限/);assert.equal(entity(s,id).rounds[0].materials.length,1);
 s=submitMaterial(as(s,'A1048'),id);s=run(as(s,'Q02'),id,'verify',{value:'fail',note:'尚缺完整的办理时效说明'});assert.equal(currentOwner(s,entity(s,id)),'A1048');assert.equal(entity(s,id).status,'executing');
});
test('F06: appeal supplement is issued and received by assigned inspector, supervisor return has two distinct routes',()=>{
 let[s,ap,r]=appeal();s=run(as(s,'Q02'),r,'supplement',{note:'请补充业务受理时间记录'});const sp=s.supplements.at(-1).id;s=run(as(s,'A1048'),sp,'reply');assert.equal(currentOwner(s,entity(s,sp)),'Q02');assert.throws(()=>run(as(s,'S01'),sp,'receive_supplement'),/不允许/);s=run(as(s,'Q02'),sp,'receive_supplement');
 s=run(s,r,'submit_review',{opinions:opinion()});s=run(as(s,'S01'),ap,'return_appeal');assert.equal(entity(s,r).status,'response');s=run(as(s,'Q02'),r,'explain_appeal',{note:'业务时间记录支持原核查结果'});assert.equal(entity(s,ap).status,'decision');s=run(as(s,'S01'),ap,'return_appeal');s=run(as(s,'Q02'),r,'agree_appeal_return');assert.equal(entity(s,r).status,'working');
});
test('F07: appeal not upheld starts rectification with appeal inspector, and cannot bypass or contradict QA review',()=>{
 let[s,ap,r]=appeal();assert.ok(!actions(s,ap).includes('accept_decide'));assert.throws(()=>run(s,ap,'decide',{...requirements,value:'maintain'}),/不允许/);
 s=run(as(s,'Q02'),r,'submit_review',{opinions:opinion()});assert.throws(()=>run(as(s,'S01'),ap,'decide',{value:'false_positive'}),/退回质检员/);
 s=run(as(s,'S01'),ap,'decide',{...requirements,value:'maintain',owner:'Q01'});assert.equal(s.remedies.at(-1).inspector,'Q02');assert.equal(s.remedies.at(-1).origin,'appeal');assert.equal(entity(s,r).status,'done');assert.ok(!actions(s,s.remedies.at(-1).id).includes('assign_inspector'));
});
test('F08: upheld appeal archives automatic false positive with evidence and optimisation feedback; rules are immutable',()=>{
 let[s,ap,r]=appeal();s=run(as(s,'Q02'),r,'submit_review',{opinions:opinion('false_positive')});s=run(as(s,'S01'),ap,'decide',{value:'false_positive'});
 const f=entity(s,'F-1037');assert.equal(f.status,'closed');assert.equal(f.distribution,undefined);assert.equal(f.optimization.status,'pending');assert.equal(latest(f).reviewer,'Q02');const rules=structuredClone(s.rules);
 s=run(s,f.id,'optimization_feedback',{value:'recorded',note:'建议补充否定语境的排除规则'});assert.deepEqual(s.rules,rules);assert.equal(entity(s,f.id).optimization.status,'recorded');
});
test('F09: no-hit manual check is independent, requires QA summary and supervisor confirmation, creates no false positive',()=>{
 let s=createInitial(now),before=s.findings.length;s=run(s,'CALL-1025','spotcheck',{scope:'核对身份核验和时效说明'});const r=s.reviews.at(-1).id;assert.throws(()=>run(s,'CALL-1025','spotcheck',{scope:'重复抽检'}),/不允许/);
 assert.throws(()=>run(as(s,'Q02'),r,'submit_review',{value:'insufficient'}),/未发现问题/);s=run(as(s,'Q02'),r,'submit_review',{value:'clear',summary:'已核对所有范围，未发现问题'});s=run(as(s,'S01'),r,'publish');assert.equal(entity(s,r).status,'done');assert.equal(s.findings.length,before);
});
test('F10: manual discovery inherits inspecting employee through distribution and acceptance',()=>{
 let s=run(createInitial(now),'CALL-1025','spotcheck',{scope:'业务说明抽检'}),r=s.reviews.at(-1).id;s=run(as(s,'Q02'),r,'add_finding',{title:'人工发现未说明时限',ruleId:s.rules[0].id});const f=s.findings.at(-1).id;
 s=run(s,r,'submit_review',{opinions:{[f]:{value:'risk',note:'人工核验时限说明缺漏',evidence:[2]}}});s=run(as(s,'S01'),r,'publish',requirements);s=run(as(s,callFor(s,f).agentId),f,'accept_result');assert.equal(s.remedies.at(-1).inspector,'Q02');assert.equal(s.remedies.at(-1).origin,'spotcheck');
});

function submittedReview(value='risk') {
 let s=createInitial(now),id='WO-1039',review=entity(s,id);
 s=run(s,id,'return_review');
 s=run(as(s,review.owner),id,'submit_review',{opinions:Object.fromEntries(review.findingIds.map(fid=>[fid,{value,note:'结合录音与业务规则完成核实',evidence:[2]}]))});
 return [as(s,'S01'),id];
}
test('F11: supervisor confirmation has exactly confirm and return branches; management applies during inspector work',()=>{
 let [s,id]=submittedReview();
 assert.deepEqual(actions(s,id),['publish','return_review']);
 for(const action of ['supplement','reassign','extend']) assert.throws(()=>run(s,id,action),/不允许/);
 s=run(s,id,'return_review',{note:'请重新核对通话中的处理时限及上下文'});
 assert.deepEqual(actions(s,id),['extend','reassign']);
 assert.equal(currentOwner(s,entity(s,id)),'Q01');assert.ok(actions(as(s,'Q01'),id).includes('submit_review'));
});
test('F12: supervisor cannot rewrite QA verdict, evidence or reasoning during confirmation',()=>{
 const [s,id]=submittedReview(),review=entity(s,id),fid=review.findingIds[0];
 assert.throws(()=>run(s,id,'publish',{...requirements,opinions:{[fid]:{value:'false_positive',note:'试图直接改判',evidence:[4]}}}),/退回质检员/);
 const next=run(s,id,'publish',{...requirements,opinions:{[fid]:{value:'risk',note:'替换质检员说明',evidence:[4]}}});
 assert.equal(latest(entity(next,fid)).note,review.opinions[fid].note);
 assert.deepEqual(latest(entity(next,fid)).evidence,review.opinions[fid].evidence);
 assert.equal(entity(s,id).status,'supervisor');
});
test('F13: false positive confirmation archives; non-false-positive confirmation distributes without rectification',()=>{
 for(const value of ['false_positive','risk']) {
  const [s,id]=submittedReview(value),fid=entity(s,id).findingIds[0];
  assert.equal(actionLabel(s,id,'publish'),value==='risk'?'确认结果并分发':'确认结果并归档');
  const next=run(s,id,'publish',value==='risk'?requirements:{});
  assert.equal(entity(next,id).status,'done');assert.deepEqual(actions(next,id),[]);
  assert.equal(entity(next,fid).status,value==='risk'?'delivered':'closed');
  assert.equal(next.remedies.length,s.remedies.length);
 }
});
test('F14: no-issue spotcheck can return to original inspector or finish, with no supplement or task management at confirmation',()=>{
 let s=run(createInitial(now),'CALL-1025','spotcheck',{scope:'身份核验与时限告知'}),id=s.reviews.at(-1).id;
 s=run(as(s,'Q02'),id,'submit_review',{value:'clear',summary:'完整检查范围，未发现问题'});s=as(s,'S01');
 assert.deepEqual(actions(s,id),['publish','return_review']);
 assert.equal(actionLabel(s,id,'publish'),'确认抽检完成');assert.equal(actionLabel(s,id,'return_review'),'退回重新抽检');
 s=run(s,id,'return_review',{note:'请补查结束前的时限告知'});assert.equal(entity(s,id).owner,'Q02');
 s=run(as(s,'Q02'),id,'submit_review',{value:'clear',summary:'重新检查指定范围，未发现问题'});
 s=run(as(s,'S01'),id,'publish');assert.equal(entity(s,id).status,'done');
 assert.equal(s.logs.at(-1).action,'确认抽检完成');
});
test('F15: evidence request has coordination action, insufficient legacy opinion must return for a concrete result',()=>{
 let s=createInitial(now);assert.ok(!actions(s,'WO-1039').includes('publish'));assert.equal(primaryAction(s,'WO-1039'),'return_review');
 s=run(as(s,'Q01'),'WO-1038','request_evidence',{note:'需要补充本次业务核验记录'});s=as(s,'S01');
 assert.deepEqual(actions(s,'WO-1038'),['supplement','return_review']);assert.equal(primaryAction(s,'WO-1038'),'supplement');
 assert.equal(actionLabel(s,'WO-1038','supplement'),'安排补证');
});
