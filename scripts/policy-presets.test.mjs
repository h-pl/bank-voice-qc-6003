import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../lib/prototype-seed.json' with {type:'json'};
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {upgradeUntouchedPolicyPresets} from '../lib/policy-presets.ts';
import {supportsWarning} from '../lib/strategy-schema.ts';
import {apply} from '../lib/workflow.ts';
const now=new Date('2026-11-01T00:00:00Z');

test('policy presets: three risk tiers cover each warning rule exactly once and all configurations save',()=>{
 let s=createPrototypeState(now);
 assert.deepEqual(s.policies.map(p=>p.level),['high','medium','low']);
 const ids=s.policies.flatMap(p=>p.ruleIds);
 assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual([...ids].sort(),s.rules.filter(r=>supportsWarning(r.indicator)).map(r=>r.id).sort());
 for(const p of s.policies){
  s=apply(s,{id:p.id,rev:p.rev,action:'save_policy',requestId:crypto.randomUUID(),input:{policy:{...p,name:p.name+'测试'}}},now);
  assert.equal(s.policies.find(x=>x.id===p.id).name,p.name+'测试');
 }
});
test('policy presets: untouched old demo upgrades once and retains evidence and workflows',()=>{
 const s=structuredClone(seed),old=structuredClone(s),upgraded=upgradeUntouchedPolicyPresets(s);
 assert.equal(upgraded.policies.length,3);
 for(const key of Object.keys(s).filter(k=>k!=='policies'))assert.deepEqual(upgraded[key],old[key],key);
 assert.deepEqual(s,old);
 assert.equal(upgradeUntouchedPolicyPresets(upgraded),upgraded);
});
test('policy presets: preserve edited, deleted, added policies and changed dependencies',()=>{
 for(const edit of [
  s=>s.policies[0].rev++,s=>s.policies[0].name='我自己的策略',s=>s.policies[0].reminderIntervalSeconds=120,
  s=>s.policies[0].recipients.push('agent'),s=>s.policies[0].ruleIds.pop(),s=>s.policies[0].level='low',
  s=>s.policies.pop(),s=>s.policies.push({...s.policies[0],id:'POL-CUSTOM'}),
  s=>s.logs.push({target:'POL-HIGH',changes:[{field:'name',before:'a',after:'b'}]}),
  s=>s.flows.find(f=>f.id==='special-review').enabled=false,
 ]){const s=structuredClone(seed);edit(s);assert.equal(upgradeUntouchedPolicyPresets(s),s);}
});
