import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {currentTaskContext,taskIsOverdue} from '../lib/case-context.ts';
import {distributionReminders} from '../lib/distribution-reminders.ts';
import {apply,entity,agentWorkItems,isTodo} from '../lib/workflow.ts';
const now=new Date('2026-10-08T08:00:00Z');
const seed=()=>({...createPrototypeState(now),identity:'A1048'});
const run=(s,id,action,input={})=>apply(s,{id,action,rev:entity(s,id).rev,requestId:`f02-${action}`,input:{note:'核对业务要求并按原流程办理',...input}},now);

test('both overdue response fixtures enter the agent filter and share reminder and detail clocks',()=>{
 const s=seed(),rows=agentWorkItems(s).filter(item=>isTodo(s,item)&&taskIsOverdue(s,item,+now));
 assert.deepEqual(rows.map(x=>x.id).sort(),['F-1032','F-CTX-AP-WITHDRAWN-F-AP-SUPPLEMENT'].sort());
 for(const f of rows){
  const task=currentTaskContext(s,f);assert.equal(task.deadlineLabel,'回应期限');assert.equal(task.dueAt,f.distribution.responseDueAt);assert.equal(task.owner.id,'A1048');
  assert.notEqual(task.dueAt,f.alertTiming.resolutionDueAt);
  const reminder=distributionReminders(s,+now).find(x=>x.target===f.id);
  assert.equal(reminder.at,task.dueAt);assert.equal(reminder.action,'坐席回应已逾期');
 }
});
test('response deadline boundary and adjustment update the current clock without clearing overdue history',()=>{
 let s=seed();const f=entity(s,'F-1032'),old=f.distribution.responseDueAt;
 assert.equal(taskIsOverdue(s,f,Date.parse(old)-1),false);assert.equal(taskIsOverdue(s,f,Date.parse(old)),true);
 s=run({...s,identity:'S01'},f.id,'adjust_distribution',{dueAt:new Date(+now+86400000).toISOString(),responseDueAt:new Date(+now+7200000).toISOString()});
 const updated=entity(s,f.id);assert.equal(updated.distribution.responseOverdueAt,old);
 assert.equal(taskIsOverdue(s,updated,+now),false);assert.equal(currentTaskContext(s,updated).dueAt,updated.distribution.responseDueAt);
 assert.ok(!distributionReminders(s,+now).some(x=>x.target===f.id&&x.action==='坐席回应已逾期'));
});
test('acceptance ends the response clock and continues with the remedy completion deadline',()=>{
 let s=seed();const f=entity(s,'F-1032'),due=f.distribution.dueAt;
 s=run(s,f.id,'accept_result');const saved=entity(s,f.id),r=s.remedies.find(x=>x.findingId===f.id);
 assert.equal(currentTaskContext(s,saved).dueAt,undefined);assert.equal(taskIsOverdue(s,saved,+now),false);
 assert.equal(currentTaskContext(s,r).dueAt,due);assert.equal(currentTaskContext(s,r).deadlineLabel,'整改完成期限');
 assert.ok(!distributionReminders(s,+now).some(x=>x.target===f.id));
});
test('appeal stops response reminders and uses the appeal/review clock as responsibility changes',()=>{
 let s=seed();const f=entity(s,'F-1032');s=run(s,f.id,'appeal',{evidence:f.evidence});
 assert.equal(currentTaskContext(s,entity(s,f.id)).dueAt,undefined);
 const a=s.appeals.find(x=>x.findingId===f.id);assert.equal(currentTaskContext(s,a).dueAt,a.dueAt);
 assert.ok(!distributionReminders(s,+now).some(x=>x.target===f.id));
 s=run({...s,identity:'S01'},a.id,'accept_assign',{owner:'Q02',dueAt:new Date(+now+3600000).toISOString()});
 const updated=entity(s,a.id),r=entity(s,updated.reviewId);
 assert.equal(currentTaskContext(s,updated).dueAt,r.dueAt);assert.equal(currentTaskContext(s,updated).deadlineLabel,'核查期限');
});
test('read-only results, completed work and paused remedies never enter the overdue filter',()=>{
 const s=seed(),f=entity(s,'F-1035');assert.equal(currentTaskContext(s,f).readOnly,true);assert.equal(currentTaskContext(s,f).dueAt,undefined);
 for(const item of [...s.reviews,...s.appeals,...s.remedies].filter(x=>['done','cancelled','withdrawn','rejected','terminated'].includes(x.status)))assert.equal(taskIsOverdue(s,item,+now+365*86400000),false,item.id);
 const r=entity(s,'REC-1036');r.dueAt=new Date(+now-10000).toISOString();r.pause={reasons:['AP-example'],startedAt:now.toISOString(),phase:r.status,owner:r.agentId,dueAt:r.dueAt,wasOverdue:true};
 assert.equal(currentTaskContext(s,r).paused,true);assert.equal(taskIsOverdue(s,r,+now),false);
});
