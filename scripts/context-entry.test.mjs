import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {agentWorkItems,standaloneSupplements,visibleTaskTarget,notices,isTodo,canSee,contextActions,entity,apply} from '../lib/workflow.ts';
import {supervisorReturnNote} from '../lib/case-context.ts';
const now=new Date('2026-09-23T00:00:00Z');
const seed=()=>createPrototypeState(now);
const as=(s,identity)=>({...s,identity});
const pending=s=>s.supplements.find(sp=>sp.target==='WO-CTX-EVIDENCE-PENDING-WO-1039-B');
test('ordinary review supplement is reachable in executor queue and notifications without exposing its parent',()=>{
 const s=as(seed(),'A1048'),sp=pending(s);
 assert.ok(canSee(s,sp.id));assert.equal(canSee(s,sp.target),false);
 assert.ok(agentWorkItems(s).some(x=>x.id===sp.id));assert.ok(notices(s).some(x=>x.id===sp.id));
 assert.equal(visibleTaskTarget(s,sp.id),sp.id);assert.deepEqual(contextActions(s,sp.id),['reply']);
 const other=as(s,'A1186');assert.equal(canSee(other,sp.id),false);assert.ok(!agentWorkItems(other).some(x=>x.id===sp.id));
 assert.ok(!standaloneSupplements(as(s,'S01')).some(x=>x.id===sp.id));
 assert.equal(visibleTaskTarget(as(s,'S01'),sp.id),sp.target);
});
test('standalone supplement reply leaves executor todo, appears on supervisor parent and returns to original reviewer',()=>{
 let s=as(seed(),'A1048');const sp=pending(s),owner=entity(s,sp.target).owner;
 const run=(id,action,input={})=>{s=apply(s,{id,action,rev:entity(s,id).rev,requestId:`entry-${action}`,input},now);};
 run(sp.id,'reply',{note:'已提供业务受理回执与时限说明',attachment:'业务回执.pdf'});
 assert.equal(isTodo(s,entity(s,sp.id)),false);assert.deepEqual(contextActions(s,sp.id),[]);
 assert.equal(visibleTaskTarget(s,sp.id),sp.id);assert.ok(agentWorkItems(s).some(x=>x.id===sp.id));
 s=as(s,'S01');assert.ok(notices(s).some(x=>x.id===sp.target));assert.ok(!notices(s).some(x=>x.id===sp.id));
 assert.deepEqual(contextActions(s,sp.id),['receive_supplement']);run(sp.id,'receive_supplement',{note:'核对本次材料并交原质检员继续'});
 s=as(s,owner);assert.ok(contextActions(s,sp.target).includes('submit_review'));assert.equal(entity(s,sp.id).status,'done');
});
test('an inspector executing another reviewer supplement also receives a standalone task',()=>{
 let s=seed();const sp=pending(s);sp.executor='Q02';s=as(s,'Q02');
 assert.equal(canSee(s,sp.target),false);assert.ok(standaloneSupplements(s).some(x=>x.id===sp.id));
 assert.ok(notices(s).some(x=>x.id===sp.id));assert.equal(visibleTaskTarget(s,sp.id),sp.id);
});
test('legacy returned review displays the latest supervisor reason without mutating records or using adjacent facts',()=>{
 const s=seed();const review=entity(s,'WO-CTX-SPOT-RETURN-WO-SPOT-2');delete review.supervisorComment;
 const before=structuredClone(s);assert.match(supervisorReturnNote(s,review),/重新核对业务受理范围/);assert.deepEqual(s,before);
 s.logs.push({id:'late-foreign',target:'another-review',actor:'S01',action:'退回重新抽检',at:'2026-10-01T00:00:00Z',note:'别的案件'});
 s.logs.push({id:'fake-return',target:review.id,actor:'A1048',action:'退回重新抽检',at:'2026-10-01T00:00:00Z',note:'坐席不是主管'});
 assert.match(supervisorReturnNote(s,review),/重新核对业务受理范围/);
 review.supervisorComment='已记录的最新退回要求';assert.equal(supervisorReturnNote(s,review),review.supervisorComment);
});
