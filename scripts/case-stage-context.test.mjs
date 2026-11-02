import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {distributionContext,responsibilityContext,supervisorReturnNote} from '../lib/case-context.ts';
import {entity,contextActions,needsWork,canSee,notices,standaloneSupplements,apply} from '../lib/workflow.ts';
const now=new Date('2026-09-23T00:00:00Z');
const seed=()=>createPrototypeState(now);
const as=(s,identity)=>({...s,identity});
const rows=[
 ['S01','F-1041',['dispatch','dismiss','assign']],
 ['S01','WO-1039',['publish','return_review']],
 ['S01','WO-SPOT-2',['publish','return_review']],
 ['S01','WO-CTX-SPOT-FOUND-WO-SPOT-1',['publish','return_review']],
 ['S01','WO-CTX-EVIDENCE-REQUEST-WO-1039-B',['supplement','return_review']],
 ['S01','AP-1033',['accept_assign','extend']],
 ['S01','AP-AP-DECISION',['decide','return_appeal']],
 ['S01','REC-UI-3',['close_remedy','return_remedy']],
 ['S01','REC-UI-1',['change_standard','extend','assign_inspector']],
 ['S01','REC-UI-8',[]],
 ['Q01','WO-1038',['submit_review','request_evidence']],
 ['Q01','WO-CTX-SPOT-LINK-NEW-1',['submit_review','request_evidence','add_finding','link_finding']],
 ['Q02','WO-CTX-AP-RECHECK-WO-AP-UI-7',['submit_review','supplement']],
 ['Q02','WO-AP-UI-7',['agree_appeal_return','explain_appeal']],
 ['Q02','REC-UI-2',['verify']],
 ['Q02','REC-REC-RESPONSE',['agree_remedy_return','explain_remedy']],
 ['Q01','REC-UI-2',[]],
 ['A1048','F-1032',['accept_result','ack','appeal','request_distribution_extension']],
 ['A1048','F-1035',['ack']],
 ['A1048','REC-1036',['adjust_request','material']],
 ['A1186','REC-REC-FAIL',['adjust_request','material']],
 ['A1048','REC-UI-3',[]],
];
test('Feishu three workflows: exact stage decisions for 22 role/object boundaries',()=>{
 const s=seed();for(const [identity,id,expected] of rows){assert.ok(entity(s,id),id);assert.deepEqual(contextActions(as(s,identity),id).sort(),expected.slice().sort(),`${identity}/${id}`);}
});
test('acknowledgement is attributed to its reader without inventing a business task',()=>{
 const s=as(seed(),'A1048');const f=entity(s,'F-1035'),c=responsibilityContext(s,f);
 assert.equal(needsWork(s,f),false);assert.equal(c.badge,'待确认知悉');assert.equal(c.owner.id,'A1048');
 const pending=responsibilityContext(s,entity(s,'F-1032'));assert.equal(pending.badge,'轮到我处理');assert.equal(pending.readOnly,false);
 f.seenSequence=f.conclusions.at(-1).sequence;assert.equal(responsibilityContext(s,f).badge,'无待办');
});
test('parallel assignment belongs to supervisor while agent continues to own material submission',()=>{
 const s=seed(),r=entity(s,'REC-1036');assert.equal(responsibilityContext(s,r).owner.id,'S01');assert.equal(responsibilityContext(s,r).badge,'待指派核验人');
 assert.equal(responsibilityContext(as(s,r.agentId),r).owner.id,r.agentId);
 r.pause={reasons:['AP-test'],startedAt:now.toISOString(),phase:r.status,owner:r.agentId,dueAt:r.dueAt,wasOverdue:false};
 assert.equal(needsWork(s,r),false);assert.equal(responsibilityContext(s,r).badge,'申诉暂停');assert.ok(!notices(s).some(x=>x.id===r.id));assert.deepEqual(contextActions(s,r.id),[]);
});
test('appeal context never instructs a second acceptance or assignment',()=>{
 const s=seed(),ap=entity(s,'AP-AP-DECISION'),f=entity(s,ap.findingId);
 for(const item of [ap,entity(s,ap.reviewId),f]){
  const c=distributionContext(s,item,f);assert.equal(c.title,'原处理结果与整改要求');assert.equal(c.inspector,'原分发时未指定');assert.match(c.guidance,/沿用本案核查质检员/);assert.doesNotMatch(c.inspector,/接受整改后/);
 }
});
test('remedy summary uses current amended requirements, deadline and inspector, preserving original distribution',()=>{
 const s=seed(),r=entity(s,'REC-UI-2'),f=entity(s,r.findingId),original=structuredClone(f.distribution);
 Object.assign(r,{goal:'本轮纠正安全核验',standard:'覆盖全部核验步骤',observation:'主管补充的核验范围',sampleCount:3,dueAt:'2026-10-01T00:00:00Z'});
 const c=distributionContext(s,r,f);assert.equal(c.title,'本轮整改要求');assert.equal(c.standard,r.standard);assert.equal(c.sampleCount,3);assert.equal(c.dueAt,r.dueAt);assert.equal(c.inspector,'林悦');assert.deepEqual(f.distribution,original);
});
test('inspector supplement is a stable mock with a complete reply-receive-resume lifecycle',()=>{
 let s=as(seed(),'Q02');const sp=s.supplements.find(x=>x.target==='WO-CTX-EVIDENCE-INSPECTOR-WO-1039-B');assert.ok(sp);assert.equal(canSee(s,sp.target),false);assert.ok(standaloneSupplements(s).some(x=>x.id===sp.id));assert.deepEqual(contextActions(s,sp.id),['reply']);
 const run=(id,action)=>{s=apply(s,{id,action,rev:entity(s,id).rev,requestId:`inspector-${action}`,input:{note:'已核对并补充业务受理记录'}},now);};
 run(sp.id,'reply');s=as(s,'S01');assert.deepEqual(contextActions(s,sp.id),['receive_supplement']);run(sp.id,'receive_supplement');
 s=as(s,'Q01');assert.deepEqual(contextActions(s,sp.target),['submit_review','request_evidence']);
});
test('legacy supervisor return is available to both appeal and remedy response dialogs',()=>{
 const s=seed();for(const id of ['WO-AP-UI-7','REC-REC-RESPONSE']){const item=entity(s,id);delete item.supervisorComment;assert.ok(supervisorReturnNote(s,item),id);}
});
