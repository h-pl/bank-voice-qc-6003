import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {apply,entity,actions} from '../lib/workflow.ts';
import {taskDeadlineLimit,defaultTaskDeadline} from '../lib/task-deadlines.ts';
const now=new Date('2026-10-08T05:15:00Z');
const seed=()=>createPrototypeState(now);
const lateEvents=(s,id)=>s.logs.filter(l=>l.overrun?.requestId===id);
const command=(s,id,action,input,requestId)=>({id,action,rev:entity(s,id).rev,requestId,input:{note:'按原流程核对证据继续办理',...input}});

test('expired warning assigns through the original action, retains exact deadline and records one overrun',()=>{
 const s=seed(),f=entity(s,'F-1031'),before=structuredClone(s),deadline=taskDeadlineLimit(s,f);
 assert.ok(Date.parse(deadline)<+now);
 assert.equal(defaultTaskDeadline(s,f,'assign',+now),deadline);
 const minute=new Date(Math.floor(Date.parse(deadline)/60000)*60000).toISOString();
 const cmd=command(s,f.id,'assign',{owner:'Q01',dueAt:minute},'late-assign');
 const next=apply(s,cmd,now),r=next.reviews.at(-1),log=lateEvents(next,cmd.requestId)[0];
 assert.equal(r.status,'pending');assert.equal(r.owner,'Q01');assert.equal(r.dueAt,deadline);assert.equal(r.originalDueAt,deadline);assert.equal(r.firstOverdueAt,deadline);
 assert.equal(entity(next,f.id).status,'review');assert.deepEqual(entity(next,f.id).alertTiming,f.alertTiming);
 assert.equal(log.action,'超时提交');assert.equal(log.actor,'S01');assert.equal(log.overrun.owner,'S01');assert.equal(log.overrun.deadlineAt,f.alertTiming.triageDueAt);assert.equal(log.overrun.submittedAt,now.toISOString());assert.equal(log.overrun.exceededByMs,+now-Date.parse(f.alertTiming.triageDueAt));
 assert.equal(lateEvents(next,cmd.requestId).length,1);assert.equal(apply(next,cmd,new Date(+now+1000)),next);assert.deepEqual(s,before);
});
test('expired assignment follows the same inspector submission and supervisor archive path',()=>{
 let s=seed();const f=entity(s,'F-1031'),deadline=taskDeadlineLimit(s,f);
 s=apply(s,command(s,f.id,'assign',{owner:'Q01',dueAt:deadline},'path-assign'),now);
 const r=s.reviews.at(-1);s={...s,identity:'Q01'};
 s=apply(s,command(s,r.id,'submit_review',{opinions:{[f.id]:{value:'false_positive',note:'已核对完整上下文符合例外',evidence:f.evidence}}},'path-submit'),new Date(+now+1000));
 assert.equal(entity(s,r.id).status,'supervisor');assert.equal(lateEvents(s,'path-submit').length,1);assert.equal(lateEvents(s,'path-submit')[0].overrun.owner,'Q01');
 s={...s,identity:'S01'};assert.ok(actions(s,r.id).includes('publish'));
 s=apply(s,command(s,r.id,'publish',{},'path-publish'),new Date(+now+2000));
 assert.equal(entity(s,r.id).status,'done');assert.equal(entity(s,f.id).status,'closed');assert.equal(lateEvents(s,'path-publish').length,1);assert.equal(entity(s,r.id).dueAt,deadline);
});
test('on-time assignment and the exact deadline do not generate overrun events',()=>{
 for(const offset of [-1000,0]){
  const s=seed(),f=entity(s,'F-1041'),at=new Date(Date.parse(f.alertTiming.triageDueAt)+offset);
  const cmd=command(s,f.id,'assign',{owner:'Q01',dueAt:taskDeadlineLimit(s,f)},'ontime-'+offset);
  assert.equal(lateEvents(apply(s,cmd,at),cmd.requestId).length,0);
 }
});
test('failed validation, stale revisions and unauthorized users cannot log or mutate a late submission',()=>{
 const s=seed(),f=entity(s,'F-1031'),before=structuredClone(s),valid={owner:'Q01',dueAt:taskDeadlineLimit(s,f)};
 for(const input of [{...valid,owner:'S01'},{...valid,note:''},{...valid,dueAt:''},{...valid,dueAt:'invalid'}]) assert.throws(()=>apply(s,command(s,f.id,'assign',input,'failed'),now));
 assert.throws(()=>apply(s,{...command(s,f.id,'assign',valid,'stale'),rev:f.rev+1},now));
 assert.throws(()=>apply({...s,identity:'A1048'},command(s,f.id,'assign',valid,'unauthorized'),now));
 assert.deepEqual(s,before);
});
test('late direct triage keeps its normal conclusion and records the original warning deadline',()=>{
 const s=seed(),f=entity(s,'F-1031');
 const cmd=command(s,f.id,'dismiss',{value:'false_positive',evidence:f.evidence},'late-dismiss');
 const next=apply(s,cmd,now);assert.equal(entity(next,f.id).status,'closed');assert.equal(lateEvents(next,cmd.requestId).length,1);
 assert.deepEqual(entity(next,f.id).alertTiming,f.alertTiming);
});
test('returning an expired review retains its recorded deadline including seconds',()=>{
 let s=seed();const f=entity(s,'F-1031');s=apply(s,command(s,f.id,'assign',{owner:'Q01',dueAt:taskDeadlineLimit(s,f)},'return-assign'),now);
 const r=s.reviews.at(-1);r.status='supervisor';r.opinions={[f.id]:{value:'risk',note:'依据完整证据判定',evidence:f.evidence}};
 const due=r.dueAt;assert.equal(defaultTaskDeadline(s,r,'return_review',+now),due);
 const next=apply(s,command(s,r.id,'return_review',{dueAt:new Date(Math.floor(Date.parse(due)/60000)*60000).toISOString()},'late-return'),now);
 assert.equal(entity(next,r.id).dueAt,due);assert.equal(entity(next,r.id).status,'working');assert.equal(lateEvents(next,'late-return').length,1);
});
