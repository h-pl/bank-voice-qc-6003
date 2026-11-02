import test from 'node:test';
import assert from 'node:assert/strict';
import {resourceRows,serializeRows,validateResourceRows,readResourceFile} from '../lib/resource-import.ts';
import {resourceSchemas} from '../lib/strategy-schema.ts';
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {ensureSystemSettings} from '../lib/configuration-schema.ts';
import {apply} from '../lib/workflow.ts';
const legacy='知识主题,知识内容,依据名称,生效日期,失效日期\n转账查询,核验身份后查询,业务口径,2026-01-01,2026-12-31';
test('knowledge migration preserves content and removes date fields idempotently',()=>{
 const state=createPrototypeState(new Date('2026-10-31T12:00:00Z'));
 const resource=state.resources.find(r=>r.kind==='professional');resource.knowledge=legacy;
 const calls=structuredClone(state.calls);ensureSystemSettings(state);
 assert.deepEqual(resourceRows('knowledge',legacy),[['转账查询','核验身份后查询','业务口径']]);
 assert.deepEqual(validateResourceRows('knowledge',resource.knowledge),[['转账查询','核验身份后查询','业务口径']]);
 assert.deepEqual(state.calls,calls);const once=resource.knowledge;ensureSystemSettings(state);assert.equal(resource.knowledge,once);
});
test('three-column knowledge imports and saves alongside unchanged SOP content',async()=>{
 const state=createPrototypeState(new Date('2026-10-31T12:00:00Z')),resource=state.resources.find(r=>r.kind==='professional');
 const content=serializeRows([resourceSchemas.knowledge.fields,['挂失办理','核实卡片信息','业务规范']]);
 const imported=await readResourceFile(new File([content],'业务知识.csv'),'knowledge');
 const next=apply(state,{id:resource.id,rev:resource.rev,action:'save_resource',requestId:crypto.randomUUID(),input:{content:resource.content,knowledge:imported}},new Date('2026-10-31T12:01:00Z'));
 const saved=next.resources.find(r=>r.id===resource.id);assert.equal(saved.knowledge,content);assert.equal(saved.content,resource.content);
 assert.throws(()=>validateResourceRows('knowledge','知识主题,知识内容,依据名称\n主题,,依据'),/知识内容必填/);
});
