import {splitLegacyReviews} from '../lib/single-problem-reviews.ts';
import {legacyInitial} from './helpers/legacy-initial.mjs';
import {legacyIssued} from './helpers/legacy-issuance.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitial} from '../lib/fixtures.ts';
import {apply,actions,entity,latest,canSee,notices,isTodo,supplementExecutors,primaryAction} from '../lib/workflow.ts';
import {report,reportCsv} from '../lib/reports.ts';
const now=new Date('2026-09-13T10:00:00+08:00'), due='2026-09-16T10:00:00+08:00';
let n=0;
const start=()=>createInitial(now), as=(s,identity)=>({...s,identity});
const run=(s,id,action,input={},time=now)=>apply(s,{id,action,rev:entity(s,id).rev,requestId:`refine-${++n}`,input:{note:'核对补充记录及完整事实依据',owner:'Q01',dueAt:due,evidence:[2],...input}},time);
function verification(count=2){let s=legacyIssued(now,due,count),id=s.remedies.at(-1).id;s=run(as(s,'A1048'),id,'accept_remedy');s=run(s,id,'sample_calls');s=run(s,id,'material',{samples:[s.calls.at(-1).id]});return[s,id];}

test('R01: supplement adds second sample to original round and reaches supervisor closure',()=>{
 let[s,id]=verification();s=run(as(s,'Q01'),id,'verify',{value:'insufficient'});const sp=s.supplements.at(-1).id;
 assert.ok(notices(as(s,'A1048')).some(x=>x.id===id));assert.ok(!notices(as(s,'Q01')).some(x=>x.id===id));
 s=run(as(s,'A1048'),id,'sample_calls');s=run(s,sp,'reply',{samples:[s.calls.at(-1).id]});
 assert.equal(entity(s,id).round,1);assert.equal(new Set(entity(s,id).materials.flatMap(m=>m.samples)).size,2);
 assert.ok(notices(as(s,'Q01')).some(x=>x.id===id));
 assert.throws(()=>run(as(s,'S01'),sp,'receive_supplement'),/不允许/);
 s=run(as(s,'Q01'),sp,'receive_supplement');s=run(s,id,'verify',{value:'pass'});s=run(as(s,'S01'),id,'close_remedy');assert.equal(entity(s,id).status,'done');
});
test('R02: executor options and command reject a different agent, inspectors get scoped access on assignment',()=>{
 let s=run(as(start(),'Q01'),'WO-1038','request_evidence');s=as(s,'S01');
 assert.ok(!supplementExecutors(s,'WO-1038').some(p=>p.id==='A1186'));
 assert.throws(()=>run(s,'WO-1038','supplement',{owner:'A1186'}),/无此通话/);
 for(const p of supplementExecutors(s,'WO-1038')){const next=run(s,'WO-1038','supplement',{owner:p.id}),sp=next.supplements.at(-1);assert.ok(canSee(as(next,p.id),sp.id));assert.ok(actions(as(next,p.id),sp.id).includes('reply'));}
});
test('R03: active appeal cannot be overwritten from finding or another review and can still withdraw',()=>{
 const s=legacyInitial(now);assert.ok(!actions(s,'F-1033').includes('followup'));assert.throws(()=>run(s,'F-1033','followup'),/不允许/);
 const withdrawn=run(as(s,'A1048'),'AP-1033','withdraw');assert.equal(entity(withdrawn,'REC-1033').pause,undefined);assert.equal(latest(entity(withdrawn,'F-1033')).sequence,1);
});
test('R03: ordinary follow-up conclusion change terminates old personnel remedy and its supplements',()=>{
 let s=legacyInitial(now);s=run(s,'F-1034','followup',{owner:'A1186'});s=run(s,'F-1034','dismiss',{value:'false_positive'});
 assert.equal(entity(s,'REC-1034').status,'terminated');assert.match(entity(s,'REC-1034').terminationReason,/误报/);assert.equal(latest(entity(s,'F-1034')).sequence,2);
});
test('R04: inspector submitted evidence is immutable per conclusion sequence',()=>{
 let s=start(),r=entity(s,'WO-1039'),fid=r.findingIds[0],original=[...entity(s,fid).evidence];
 r.findingIds=[fid];s=run(s,r.id,'return_review');s=run(as(s,r.owner),r.id,'submit_review',{opinions:{[fid]:{value:'risk',note:'依据第四片段进行质检判断',evidence:[3]}}});s=as(s,'S01');s=run(s,r.id,'publish',{goal:'改善服务表达',standard:'完整说明服务范围',observation:'提交同业务通话',sampleCount:1,opinions:{[fid]:{value:'risk',note:'依据第四片段进行主管判断',evidence:[3]}}});
 assert.deepEqual(latest(entity(s,fid)).evidence,[3]);assert.deepEqual(entity(s,fid).evidence,original);
 assert.ok(!actions(s,fid).includes('followup'));
 assert.throws(()=>run(s,fid,'followup'),/不允许/);
 assert.deepEqual(entity(s,fid).conclusions.map(c=>c.evidence),[[3]]);
});
test('R05: failed round retains material, samples and standards while new round starts empty',()=>{
 let[s,id]=verification(1);const materials=structuredClone(entity(s,id).materials);s=run(as(s,'Q01'),id,'verify',{value:'fail'});
 const r=entity(s,id);assert.equal(r.round,2);assert.deepEqual(r.materials,[]);assert.deepEqual(r.rounds[0].materials,materials);assert.equal(r.rounds[0].acceptance.result,'fail');assert.ok(r.rounds[0].standard);
});
test('R06: returning an overdue review retains first overdue and deadline change in CSV',()=>{
 let s=start(),old=entity(s,'WO-1039').dueAt;const time=new Date(Date.parse(old)+60000);s=run(s,'WO-1039','return_review',{},time);
 const r=entity(s,'WO-1039');assert.equal(r.firstOverdueAt,old);assert.equal(r.deadlineChanges[0].from,old);assert.equal(r.deadlineChanges[0].to,due);
 const f={business:'',agent:'',group:'',start:'2026-09-01',end:'2026-09-30'};const metric=report(s,f,time).find(m=>m.key==='review-backlog');assert.ok(reportCsv(metric,s,time.toISOString(),f).includes('期限变更记录'));
});
test('R07: separate requirements wait for each agent decision and retain original reviewer',()=>{
 let s=start();const r=entity(s,'WO-1039'),a=r.findingIds[0],b=entity(s,'WO-1039-B').findingIds[0];
 for(const id of [r.id,'WO-1039-B']){s=run(s,id,'return_review');const review=entity(s,id);s=run(as(s,review.owner),id,'submit_review',{opinions:Object.fromEntries(review.findingIds.map(fid=>[fid,{value:'risk',note:'质检员完成逐项核实',evidence:[2]}]))});s=as(s,'S01');}
 const requirement={remedy:true,goal:'改善业务说明',standard:'完整说明业务条件',owner:'Q02',dueAt:due,sampleCount:2,observation:'后续同业务样例'};
 s=run(s,r.id,'publish',{opinions:{[a]:{value:'risk',note:'第一项已有充分事实依据',evidence:[2]}},dispositions:{[a]:requirement}});
 s=run(s,'WO-1039-B','publish',{opinions:{[b]:{value:'risk',note:'第二项独立核对后确认',evidence:[4]}},dispositions:{[b]:{...requirement,goal:'改善服务表达'}}});
 assert.equal(s.remedies.filter(r=>[a,b].includes(r.findingId)).length,0);
 s=run(as(s,'A1048'),b,'accept_result');assert.equal(s.remedies.at(-1).inspector,'Q01');assert.equal(s.remedies.at(-1).goal,'改善服务表达');assert.equal(entity(s,a).distribution.status,'pending');
});
test('R07: unresolved existing fact can be linked without a new Finding or changing its source',()=>{
 let s=run(start(),'CALL-1031','spotcheck',{scope:'敏感信息补充核对'});const r=s.reviews.at(-1),count=s.findings.length;
 s=run(as(s,'Q01'),r.id,'link_finding',{findingId:'F-1031'});assert.ok(entity(s,r.id).findingIds.includes('F-1031'));assert.equal(s.findings.length,count);assert.equal(entity(s,'F-1031').source,'auto');
 assert.throws(()=>run(s,r.id,'link_finding',{findingId:'F-1031'}),/已经关联|不允许/);
});
test('R08: live call allows draft, rejects formal submission, and reuses the task after ending',()=>{
 let s=run(start(),'F-1041','assign');const r=s.reviews.at(-1),fid=r.findingIds[0];const opinions={[fid]:{value:'risk',note:'尚在通话中的证据草稿',evidence:[2]}};
 s=run(as(s,'Q01'),r.id,'save_review',{opinions});assert.ok(!actions(s,r.id).includes('submit_review'));assert.throws(()=>run(s,r.id,'submit_review',{opinions}),/不允许|结束/);
 const count=s.reviews.length;s=run(as(s,'S01'),'CALL-1041','end_call');assert.equal(s.reviews.length,count);s=run(as(s,'Q01'),r.id,'submit_review',{opinions});assert.equal(entity(s,r.id).status,'supervisor');
});
test('R09: inspector requests evidence before verdict, supervisor assigns, supplement returns to same draft',()=>{
 let s=as(start(),'Q01');s=run(s,'WO-1038','save_review',{opinions:{'F-1040':{value:'insufficient',note:'等待有效核验记录',evidence:[1]}}});
 s=run(s,'WO-1038','request_evidence',{note:'需要补取 IVR 身份核验记录'});assert.ok(isTodo(as(s,'S01'),entity(s,'WO-1038')));assert.ok(!actions(as(s,'S01'),'WO-1038').includes('publish'));
 s=run(as(s,'S01'),'WO-1038','supplement',{owner:'A1048'});const sp=s.supplements.at(-1);s=run(as(s,'A1048'),sp.id,'reply');s=run(as(s,'S01'),sp.id,'receive_supplement');
 assert.equal(entity(s,'WO-1038').status,'working');assert.equal(entity(s,'WO-1038').owner,'Q01');assert.match(entity(s,'WO-1038').opinions['F-1040'].note,/等待/);assert.ok(isTodo(as(s,'Q01'),entity(s,'WO-1038')));
});
test('R10/R12: pending reads are tasks, paused remedies are not, next business action is primary',()=>{
 const s=as(splitLegacyReviews(legacyInitial(now),now),'A1048');assert.ok(isTodo(s,entity(s,'F-1035')));assert.ok(!isTodo(s,entity(s,'REC-1033')));assert.equal(primaryAction(s,'AP-1033'),undefined);
 assert.equal(primaryAction(as(s,'Q01'),'WO-1038'),'submit_review');assert.equal(primaryAction(as(s,'S01'),'WO-1039'),'publish');assert.equal(primaryAction(as(s,'S01'),'WO-1039-S2'),'return_review');
});
test('C03: compound acceptance is atomic, records both events, and request retry is idempotent',()=>{
 const s=legacyInitial(now);const cmd={id:'AP-1033',rev:entity(s,'AP-1033').rev,action:'accept_assign',requestId:'compound',input:{owner:'Q02',dueAt:due,note:'由其他质检员进行独立核查'}};
 const next=apply(s,cmd,now);assert.equal(entity(next,'AP-1033').status,'reviewing');assert.equal(next.logs.length,s.logs.length+2);assert.equal(apply(next,cmd,now),next);
 assert.throws(()=>apply(s,{...cmd,input:{...cmd.input,owner:'A1186'}},now),/质检员/);assert.equal(entity(s,'AP-1033').status,'submitted');
 const decided=run(s,'AP-1033','accept_decide',{value:'false_positive',evidence:[1],owner:''});assert.equal(entity(decided,'AP-1033').status,'done');assert.equal(entity(decided,'REC-1033').status,'terminated');assert.deepEqual(latest(entity(decided,'F-1033')).evidence,[1]);
});

test('R09: appeal review evidence request returns via supervisor to the same inspector',()=>{
 let s=run(start(),'AP-1033','accept_assign',{owner:'Q02'});const id=entity(s,'AP-1033').reviewId;
 s=run(as(s,'Q02'),id,'supplement',{note:'需要坐席补充自动核验依据'});const sp=s.supplements.at(-1);
 assert.equal(sp.target,'AP-1033');assert.equal(sp.executor,'A1048');
 s=run(as(s,'A1048'),sp.id,'reply');s=run(as(s,'Q02'),sp.id,'receive_supplement');
 assert.equal(entity(s,id).owner,'Q02');assert.equal(entity(s,id).evidenceRequest,undefined);assert.ok(actions(as(s,'Q02'),id).includes('submit_review'));
});
