import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {createAlertTiming, withAlertDeadlines, activeDeadline, deadlineRemaining} from '../lib/alert-deadlines.ts';
import {apply} from '../lib/workflow.ts';
const now=new Date('2026-09-23T12:00:00+08:00');
test('warning preset durations and minute display match PRD',()=>{
 for(const [level,triage,total] of [['high',5,120],['medium',30,480],['low',120,1440]]){
  const t=createAlertTiming(now.toISOString(),level);
  assert.equal(Date.parse(t.triageDueAt)-Number(now),triage*60000);
  assert.equal(Date.parse(t.resolutionDueAt)-Number(now),total*60000);
 }
 assert.equal(deadlineRemaining(new Date(+now+120000).toISOString(),+now),'剩余约 2 分钟');
 assert.match(deadlineRemaining(now.toISOString(),+now),/^已逾期/);
});
test('existing demo migrates once from earliest trigger, never refresh time or unknown history',()=>{
 const s=createPrototypeState(now);for(const f of s.findings)delete f.alertTiming;
 const before=structuredClone(s);const migrated=withAlertDeadlines(s);
 assert.deepEqual(s,before);assert.ok(migrated.findings.filter(f=>f.source==='auto').every(f=>f.alertTiming));
 assert.equal(withAlertDeadlines(migrated),migrated);
 assert.deepEqual(migrated.reviews,s.reviews);assert.deepEqual(migrated.logs,s.logs);
 const f=migrated.findings.find(f=>f.id==='F-1041');assert.equal(Date.parse(f.alertTiming.triageDueAt)-Date.parse(f.alertTiming.triggeredAt),300000);
 const missing={...s,logs:[]};assert.equal(withAlertDeadlines(missing),missing);
});
test('assign advances to original total deadline; archive or distribution ends alert clock',()=>{
 const s=createPrototypeState(now),f=s.findings.find(f=>f.id==='F-1041');
 assert.equal(activeDeadline(f),f.alertTiming.triageDueAt);
 const assigned=apply(s,{id:f.id,rev:f.rev,action:'assign',requestId:'deadline-assign',input:{owner:'Q01',note:'核实原话',dueAt:new Date(+now+3600000).toISOString()}},now);
 const saved=assigned.findings.find(x=>x.id===f.id);
 assert.deepEqual(saved.alertTiming,f.alertTiming);assert.equal(activeDeadline(saved),f.alertTiming.resolutionDueAt);
 const archived=apply(s,{id:f.id,rev:f.rev,action:'dismiss',requestId:'deadline-dismiss',input:{value:'false_positive',note:'完整上下文符合例外',evidence:f.evidence}},now).findings.find(x=>x.id===f.id);
 assert.equal(activeDeadline(archived),undefined);assert.deepEqual(archived.alertTiming,f.alertTiming);
 for(const finished of s.findings.filter(f=>['closed','delivered'].includes(f.status)))assert.equal(activeDeadline(finished),undefined);
});
