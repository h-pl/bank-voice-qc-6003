import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {apply,entity} from '../lib/workflow.ts';
import {captureRules,policyFor} from '../lib/configuration.ts';
import {ensureSystemSettings} from '../lib/configuration-schema.ts';
import {ingestDetection,reconcileAlerts} from '../lib/call-alerts.ts';

const now=new Date('2026-11-02T04:00:00Z');
const run=(s,id,action,input={})=>apply(s,{id,rev:entity(s,id).rev,action,input,requestId:crypto.randomUUID()},now);
function fresh(){
 const s=createPrototypeState(now);s.calls=[s.calls[0]];
 const call=s.calls[0];call.duration=120;call.endedAt=now.toISOString();
 call.batches=[{id:'B-binding',startedAt:now.toISOString(),rules:captureRules(s,now.toISOString()),checks:[{name:'检测',state:'success'}]}];
 for(const key of ['findings','reviews','appeals','remedies','supplements','alerts','logs','notificationDeliveries'])s[key]=[];
 return s;
}
function hit(s,problemKey='old',ruleId='R-COM-012'){
 const basis=s.calls[0].batches[0].rules.find(r=>r.ruleId===ruleId),c=basis.conditions[0];
 return ingestDetection(s,{key:crypto.randomUUID(),problemKey,ruleId,callId:s.calls[0].id,batchId:'B-binding',feature:c.feature,role:c.role,stage:c.stage,count:10,duration:30,atSecond:20,evidence:[0],title:problemKey},now);
}
function moveRule(s){
 const old=policyFor(s,'R-COM-012');
 s=run(s,old.id,'save_policy',{policy:{...old,ruleIds:old.ruleIds.filter(id=>id!=='R-COM-012')}});
 s=run(s,s.rules[0].id,'create_policy',{policy:{name:'新低风险策略',ruleIds:['R-COM-012'],level:'low',recipients:['agent'],flowId:'special-review',reminderIntervalSeconds:60}});
 return s;
}

test('reassigning a rule preserves old problem association, deadlines and workflow; new problems use new policy',()=>{
 let s=hit(fresh());const original=structuredClone(s.findings[0]);
 s=moveRule(s);
 assert.equal(s.findings[0].severity,'high');assert.deepEqual(s.findings[0].alertTiming,original.alertTiming);
 assert.deepEqual(s.findings[0].hits,original.hits);assert.deepEqual(s.findings[0].workflow,original.workflow);
 s=hit(s);assert.equal(s.findings.length,1);assert.equal(s.findings[0].hits[1].policy.id,original.hits[0].policy.id);
 assert.equal(s.findings[0].severity,'high');assert.equal(s.reviews.length,0);
 s=hit(s,'new');assert.equal(s.findings[1].severity,'low');assert.equal(s.findings[1].workflow.flowId,'special-review');assert.equal(s.reviews.length,1);
 const oldPolicy=s.policies.find(p=>p.id===original.hits[0].policy.id);
 s=run(s,oldPolicy.id,'save_policy',{policy:{...oldPolicy,level:'medium'}});
 assert.equal(s.findings[0].severity,'medium');assert.equal(s.findings[1].severity,'low');assert.equal(s.findings[0].hits[0].policy.level,'high');
 assert.deepEqual(s.findings[0].alertTiming,original.alertTiming);
 const newPolicy=policyFor(s,'R-COM-012');
 s=run(s,newPolicy.id,'save_policy',{policy:{...newPolicy,level:'high'}});
 assert.equal(s.findings[0].severity,'medium');assert.equal(s.findings[1].severity,'high');
});

test('deletion retains last original-policy level across refresh and repeat callbacks; new problems use defaults',()=>{
 let s=hit(fresh()),p=policyFor(s,'R-COM-012');
 s=run(s,p.id,'save_policy',{policy:{...p,level:'low'}});
 s=run(s,p.id,'delete_policy');
 assert.equal(policyFor(s,'R-COM-012'),undefined);assert.equal(s.findings[0].severity,'low');
 s=reconcileAlerts(JSON.parse(JSON.stringify(s)),now);s=hit(s);
 assert.equal(s.findings[0].severity,'low');assert.equal(s.findings[0].hits[0].policy.level,'high');assert.equal(s.findings[0].hits[1].policy.id,p.id);
 s=hit(s,'new');assert.equal(s.findings[1].severity,s.defaults.level);assert.equal(s.findings[1].hits[0].policy.id,undefined);
});

test('a default-bound problem stays default-bound after a strategy is added',()=>{
 let s=fresh(),p=policyFor(s,'R-COM-012');s=run(s,p.id,'delete_policy');s=hit(s);
 s=run(s,s.rules[0].id,'create_policy',{policy:{...p,name:'后续新策略',level:'low',ruleIds:['R-COM-012']}});
 s=hit(s);assert.equal(s.findings[0].severity,s.defaults.level);assert.ok(s.findings[0].hits.every(h=>h.policy.id===undefined));
 s=hit(s,'new');assert.equal(s.findings[1].severity,'low');
});

test('legacy hits without policy IDs preserve recorded levels rather than infer a current association',()=>{
 let s=hit(fresh());s.findings[0].hits[0].legacy=true;delete s.findings[0].hits[0].policy.id;
 s=moveRule(s);assert.equal(s.findings[0].severity,'high');
 s=hit(s);assert.equal(s.findings[0].severity,'high');assert.equal(s.findings[0].hits[1].legacy,true);
});

test('a different rule may add its own policy to an existing problem without duplicating work',()=>{
 let s=hit(fresh());s=hit(s,'old','R-SVC-009');
 assert.equal(s.findings.length,1);assert.equal(s.findings[0].hits.length,2);
 assert.notEqual(s.findings[0].hits[0].policy.id,s.findings[0].hits[1].policy.id);
 assert.equal(s.findings[0].severity,'high');assert.equal(s.reviews.length,0);assert.ok(s.findings[0].flowConflict);
});

test('all businesses use enabled rules, ignoring old business lists; migration leaves prior evidence intact',()=>{
 const s=fresh(),before=structuredClone(s.calls[0].batches[0].rules);
 s.rules.forEach((r,i)=>{r.businesses=i%2?[]:['仅旧业务'];});s.rules[0].enabled=false;
 const expected=s.rules.filter(r=>r.enabled).map(r=>r.id);
 for(const business of ['转账汇款','新接入业务','']){s.calls[0].business=business;assert.deepEqual(captureRules(s,now.toISOString()).map(r=>r.ruleId),expected);}
 ensureSystemSettings(s);assert.ok(s.rules.every(r=>!('businesses' in r)));assert.deepEqual(s.calls[0].batches[0].rules,before);
});

test('starting detection on a newly connected business captures all enabled rules and respects disabled indicators',()=>{
 let s=fresh();const call=s.calls[0];call.business='新接入业务';
 s.rules.forEach(r=>{r.businesses=['仅旧业务'];});s.rules[0].enabled=false;
 const previous=structuredClone(call.batches[0]);
 s=run(s,call.id,'start_detection');
 assert.deepEqual(s.calls[0].batches[0],previous);
 assert.deepEqual(s.calls[0].batches.at(-1).rules.map(r=>r.ruleId),s.rules.filter(r=>r.enabled).map(r=>r.id));
 const empty=fresh();empty.rules.forEach(r=>{r.enabled=false;});
 assert.throws(()=>run(empty,empty.calls[0].id,'start_detection'),/没有已开启的指标/);
});
