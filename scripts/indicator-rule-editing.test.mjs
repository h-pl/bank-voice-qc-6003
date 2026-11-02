import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {apply,entity,actions} from '../lib/workflow.ts';
import {captureRules} from '../lib/configuration.ts';
import {migrateRuleConditions} from '../lib/configuration-schema.ts';
const now=new Date('2026-10-31T12:00:00Z');
const run=(s,r,conditions,input={})=>apply(s,{id:r.id,rev:r.rev,action:'save_rule_conditions',requestId:crypto.randomUUID(),input:{conditions,...input}},now);
test('rule conditions save on the rule, preserving resources and historical detection basis',()=>{
 let s=createPrototypeState(now);const r=s.rules.find(r=>r.id==='R-VOICE-001'),before=structuredClone(s),conditions=structuredClone(r.conditions);conditions[0].mode='累计次数';conditions[0].count=2;
 s=run(s,r,conditions);const saved=entity(s,r.id);assert.equal(saved.conditions[0].count,2);assert.equal(saved.conditions[0].mode,'累计次数');assert.equal(saved.rev,r.rev+1);
 assert.deepEqual(s.resources,before.resources);assert.deepEqual(s.policies,before.policies);assert.deepEqual(s.calls,before.calls);assert.deepEqual(s.findings.map(f=>f.basis),before.findings.map(f=>f.basis));
 const future=captureRules(s,now.toISOString()).find(x=>x.ruleId===r.id);assert.equal(future.conditions[0].count,2);assert.ok(!('conditions' in future.resource));
 const restored=JSON.parse(JSON.stringify(s));assert.equal(entity(restored,r.id).conditions[0].count,2);assert.ok(s.logs.at(-1).changes.every(c=>c.field==='conditions'));assert.equal(s.logs.at(-1).target,r.id);
});
test('rule save rejects resource writes, invalid conditions and stale rule revisions',()=>{
 let s=createPrototypeState(now);const r=s.rules.find(r=>r.id==='R-VOICE-001'),conditions=structuredClone(r.conditions);conditions[0].mode='累计次数';conditions[0].count=0;
 assert.throws(()=>run(s,r,conditions),/次数/);assert.throws(()=>run(s,r,r.conditions,{content:'替换资源文本'}),/业务资源/);assert.throws(()=>run(s,r,r.conditions.map(c=>({...c,enabled:false}))),/至少选择/);
 s=run(s,r,r.conditions.map((c,i)=>i===0?{...c,mode:'累计次数',count:2}:c));assert.throws(()=>run(s,r,r.conditions),/已更新/);assert.equal(entity(s,r.id).conditions[0].count,2);
});
test('only supervisors edit warning rules; resource commands cannot write conditions',()=>{
 const s=createPrototypeState(now),r=s.rules.find(r=>r.id==='R-VOICE-001');for(const identity of ['Q01','A1048']){assert.throws(()=>run({...s,identity},r,r.conditions),/仅主管/);assert.ok(!actions({...s,identity},r.id).includes('save_rule_conditions'));}
 assert.throws(()=>run(s,s.rules.find(r=>r.id==='R-ASR-001'),[]),/业务条件/);
 const resource=entity(s,r.resourceId);assert.deepEqual(actions(s,resource.id),['save_resource']);assert.throws(()=>run(s,resource,r.conditions),/业务条件/);
 assert.throws(()=>apply(s,{id:resource.id,rev:resource.rev,action:'save_resource',requestId:crypto.randomUUID(),input:{content:resource.content,conditions:r.conditions}},now),/指标规则/);
});
test('resource content updates retain all rule conditions and allow independent subsequent rule editing',()=>{
 let s=createPrototypeState(now);const r=s.rules.find(r=>r.id==='R-VOICE-001'),resource=entity(s,r.resourceId),before=structuredClone(s.rules);
 s=apply(s,{id:resource.id,rev:resource.rev,action:'save_resource',requestId:crypto.randomUUID(),input:{content:resource.content.replace('A1048-注册语音.wav','A1048-新注册.wav')}},now);
 assert.deepEqual(s.rules,before);assert.ok(!('conditions' in entity(s,resource.id)));
 s=run(s,r,r.conditions.map((c,i)=>i===0?{...c,mode:'累计次数',count:2}:c));assert.equal(entity(s,r.id).conditions[0].count,2);
});
test('legacy stored conditions migrate once; historical captured thresholds stay distinct from live rules',()=>{
 const s=createPrototypeState(now),r=s.rules.find(r=>r.id==='R-VOICE-001'),resource=entity(s,r.resourceId),basis=captureRules(s,now.toISOString()).find(b=>b.ruleId===r.id);
 resource.conditions=structuredClone(r.conditions);delete r.conditions;resource.conditions[0].count=7;
 basis.resource.conditions=structuredClone(basis.conditions);basis.resource.conditions[0].count=3;delete basis.conditions;
 s.calls[0].batches[0].rules=[basis];s.findings[0].basis=structuredClone(basis);
 migrateRuleConditions(s);assert.equal(r.conditions[0].count,7);assert.equal(basis.conditions[0].count,3);assert.equal(s.findings[0].basis.conditions[0].count,3);assert.ok(!('conditions' in resource));assert.ok(!('conditions' in basis.resource));
 const once=structuredClone(s);migrateRuleConditions(s);assert.deepEqual(s,once);
});
