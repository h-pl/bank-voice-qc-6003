import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrototypeState } from '../lib/prototype-seeds.ts';
import { apply, entity } from '../lib/workflow.ts';
import { captureRules, policyFor } from '../lib/configuration.ts';
import { newCondition } from '../lib/configuration-schema.ts';
import { ingestDetection, reconcileAlerts } from '../lib/call-alerts.ts';
import { callTriggers } from '../lib/call-triggers.ts';
import { report } from '../lib/reports.ts';

const now = new Date('2026-11-01T04:00:00Z');
const run = (s, id, action, input = {}, at = now) => apply(s, {id, rev:entity(s,id).rev, action, input, requestId:crypto.randomUUID()}, at);
function fresh() {
  const s = createPrototypeState(now);
  s.calls = [s.calls[0]];
  const call = s.calls[0];
  call.duration = 120;
  call.endedAt = now.toISOString();
  call.batches = [{id:'B-boundary', startedAt:now.toISOString(), rules:captureRules(s,now.toISOString(),call), checks:[{name:'检测',state:'success'}]}];
  for (const key of ['findings','reviews','appeals','remedies','supplements','alerts','logs','notificationDeliveries']) s[key] = [];
  return s;
}
function event(s, extra = {}) {
  const call = s.calls[0], basis = call.batches[0].rules.find(r=>r.ruleId==='R-COM-012'), condition = basis.conditions[0];
  return {key:crypto.randomUUID(), problemKey:'problem-one', callId:call.id, batchId:call.batches[0].id, ruleId:basis.ruleId, feature:condition.feature, role:condition.role, stage:condition.stage, count:1, duration:30, atSecond:20, evidence:[0], title:'核对业务问题', ...extra};
}

test('PRD 4.2: reminders and read receipts keep an untouched alert pending', () => {
  let s = fresh(); delete s.calls[0].endedAt;
  s = ingestDetection(s,event(s),now);
  const f = s.findings[0];
  s = run(s,f.id,'remind',{note:'请核对当前话术要求'});
  assert.equal(s.alerts[0].status,'pending');
  s = run({...s,identity:s.calls[0].agentId},f.id,'read_reminder');
  assert.equal(s.alerts[0].status,'pending');
  assert.equal(s.findings[0].alertTiming.triggeredAt,now.toISOString());
});

test('PRD 4.2/5.1: an automatic hit on a manual problem creates the alert without duplicating work', () => {
  let s = fresh();
  const manual = {...structuredClone(createPrototypeState(now).findings[0]), id:'F-manual', callId:s.calls[0].id, source:'manual', status:'candidate', problemKey:undefined, detectionKey:undefined, hits:undefined, alertTiming:undefined, conclusions:[], distribution:undefined, reminder:undefined};
  s.findings.push(manual);
  s = run(s,manual.id,'assign',{owner:'Q02',dueAt:new Date(+now+3600000).toISOString(),note:'检查人工发现的业务问题'});
  assert.equal(s.alerts.length,0);
  const originalReview = structuredClone(s.reviews[0]);
  s = ingestDetection(s,event(s,{problemKey:manual.id}),now);
  assert.equal(s.findings.length,1);
  assert.equal(s.findings[0].source,'manual');
  assert.deepEqual(s.reviews[0],originalReview);
  assert.equal(s.alerts.length,1);
  assert.deepEqual(s.alerts[0].problemIds,[manual.id]);
  assert.equal(s.alerts[0].level,'high');
  assert.equal(callTriggers(s.calls[0],s.findings).ruleCount,1);
  assert.equal(report(s,{start:'',end:'',business:'',group:'',agent:''},now).find(m=>m.key==='candidates').value,'0');
  const policy = policyFor(s,'R-COM-012');
  s = run(s,policy.id,'save_policy',{policy:{...policy,level:'low'}});
  assert.equal(s.alerts[0].level,'low');
  assert.deepEqual(s.reviews[0],originalReview);
});

test('PRD 3.5: a call with an empty service-middle interval never hits', () => {
  const s = fresh(); s.calls[0].duration = 60;
  Object.assign(s.calls[0].batches[0].rules.find(r=>r.ruleId==='R-COM-012').conditions[0],{stage:'服务中',middleStartSeconds:30,middleEndSeconds:30});
  assert.equal(ingestDetection(s,event(s,{atSecond:30}),now).findings.length,0);
});

test('PRD 3.3/3.5: invalid occurrence counts and evidence times cannot generate alerts', () => {
  for (const invalid of [{count:0},{count:-1},{count:NaN},{count:1.5},{atSecond:-1},{atSecond:NaN},{atSecond:121}]) {
    const s = fresh(), original = structuredClone(s);
    assert.throws(()=>ingestDetection(s,event(s,invalid),now),/次数|位置/);
    assert.deepEqual(s,original);
  }
});

test('PRD 3.5: active duration measurements must be finite; unused measurements are ignored', () => {
  const s = fresh(), basis = s.calls[0].batches[0].rules.find(r=>r.resource.kind==='emotion');
  Object.assign(basis.conditions[0],{mode:'持续时长',duration:15});
  const input = event(s,{ruleId:basis.ruleId,feature:basis.conditions[0].feature,role:basis.conditions[0].role,stage:basis.conditions[0].stage,duration:NaN});
  assert.throws(()=>ingestDetection(s,input,now),/持续时长/);
  assert.equal(ingestDetection(s,event(s,{duration:NaN}),now).findings.length,1);
});

test('PRD 3.1: processing indicators never create risk alerts even with legacy conditions', () => {
  for (const kind of ['hotword','correction']) {
    const s = fresh(), basis = s.calls[0].batches[0].rules.find(r=>r.resource.kind===kind);
    basis.conditions = [newCondition('指标命中')];
    assert.equal(ingestDetection(s,event(s,{ruleId:basis.ruleId}),now).findings.length,0);
  }
});

test('PRD 4.2: identical replayed evidence preserves closure without creating a new confirmation task', () => {
  let s = fresh(); const input = event(s);
  s = ingestDetection(s,input,now);
  s = run(s,s.findings[0].id,'dismiss',{value:'false_positive',note:'核对完整上下文确认误报',evidence:[0]});
  const conclusions = structuredClone(s.findings[0].conclusions);
  const nextAt = new Date(+now+1000).toISOString();
  s.calls[0].batches.push({id:'B-recheck',startedAt:nextAt,rules:captureRules(s,nextAt,s.calls[0]),checks:[{name:'检测',state:'success'}]});
  s = ingestDetection(s,{...input,key:'retry-in-new-batch',batchId:'B-recheck'},new Date(+now+1000));
  assert.equal(s.findings[0].hits.length,2);
  assert.equal(s.findings[0].pendingEvidence,undefined);
  assert.equal(s.logs.filter(l=>l.action==='新证据待确认').length,0);
  assert.equal(s.alerts[0].status,'closed');
  assert.equal(callTriggers(s.calls[0],s.findings).ruleCount,1);
  assert.deepEqual(s.findings[0].conclusions,conclusions);
  s = ingestDetection(s,{...input,key:'new-evidence',evidence:[1]},new Date(+now+2000));
  assert.equal(s.findings[0].pendingEvidence.hitIds.length,1);
});

test('PRD 3.7: enabling professionalism validates both SOP and business knowledge', () => {
  const s = fresh(), resource = s.resources.find(r=>r.kind==='professional'), rule = s.rules.find(r=>r.resourceId===resource.id);
  rule.enabled = false; resource.knowledge = '知识主题,知识内容,依据名称';
  assert.throws(()=>run(s,rule.id,'toggle_indicator'),/至少填写/);
  assert.equal(rule.enabled,false);
});

test('PRD 3.7: settings save preserves fixed identity and accepts only editable fields', () => {
  const s = fresh(), settings = s.settings;
  const saved = run(s,settings.id,'save_settings',{settings:{...settings,id:'wrong-id',settingsType:'wrong-type',displayFields:['agent','business'],rev:999}});
  assert.equal(saved.settings.id,settings.id);
  assert.equal(saved.settings.settingsType,'platform');
  assert.equal(saved.settings.rev,settings.rev+1);
  assert.deepEqual(saved.settings.displayFields,['agent','business']);
  assert.ok(entity(saved,settings.id));
});

test('PRD 4.2: reconciliations are stable when no business event occurred', () => {
  const s = ingestDetection(fresh(),event(fresh()),now), before = structuredClone(s);
  reconcileAlerts(s,new Date(+now+1000));
  assert.deepEqual(s,before);
});

test('PRD 3.6: policies save without a notification method and legacy live policies allow removing the agent', () => {
  let s = fresh();
  const policy = policyFor(s,'R-COM-012');
  policy.method = 'live'; policy.recipients = ['supervisor','agent'];
  const input = {...policy, recipients:['supervisor']};
  delete input.method;
  s = run(s,policy.id,'save_policy',{policy:input});
  assert.deepEqual(policyFor(s,'R-COM-012').recipients,['supervisor']);
  assert.equal(policyFor(s,'R-COM-012').method,'notification');
  assert.ok(!s.logs.at(-1).changes.some(c=>c.field==='method'));
});

test('PRD 3.6: realtime and post-call hits notify selected recipients through the same channel', () => {
  for (const realtime of [true,false]) {
    for (const recipients of [['supervisor'],['agent']]) {
      let s = fresh(); if(realtime)delete s.calls[0].endedAt;
      const policy = policyFor(s,'R-COM-012');
      policy.method = 'live'; policy.recipients = recipients;
      s = ingestDetection(s,event(s),now);
      const deliveries = s.notificationDeliveries;
      assert.ok(deliveries.length>0);
      assert.ok(deliveries.every(d=>d.method==='notification'&&d.at===now.toISOString()));
      assert.equal(deliveries.some(d=>d.recipient===s.calls[0].agentId),recipients.includes('agent'));
      assert.equal(s.findings[0].reminder,undefined);
      assert.equal(s.logs.filter(l=>l.action==='新问题待办').length,1);
    }
  }
});

test('PRD 3.6: legacy notification keys still deduplicate while each new problem creates a task', () => {
  for (const legacyMethod of ['notification','live']) {
    let s = fresh();
    const policy = policyFor(s,'R-COM-012');
    policy.reminderIntervalSeconds = 0;
    s = ingestDetection(s,event(s),now);
    for (const delivery of s.notificationDeliveries) {
      delivery.key += `:${legacyMethod}`; delivery.method = legacyMethod;
    }
    const count = s.notificationDeliveries.length;
    s = run(s,policy.id,'save_policy',{policy:{...policy,method:'notification'}});
    s = ingestDetection(s,event(s,{problemKey:'second-problem'}),new Date(+now+60000));
    assert.equal(s.notificationDeliveries.length,count);
    assert.equal(s.logs.filter(l=>l.action==='新问题待办').length,2);
  }
});
