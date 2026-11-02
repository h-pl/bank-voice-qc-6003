import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitial} from '../lib/fixtures.ts';
import {apply,actions,entity,latest} from '../lib/workflow.ts';
import {alertCategory,alertTabs,problemRecords,problemLogs} from '../lib/alert-records.ts';
const now=new Date('2026-09-23T10:00:00+08:00');
test('archive retains the original issue and evidence and occupies only the archive category',()=>{
 let s=createInitial(now);const f=entity(s,'F-1037');const evidence=structuredClone(f.evidence);
 s=apply(s,{id:f.id,rev:f.rev,action:'dismiss',requestId:'archive-test',input:{value:'false_positive',note:'核对上下文，该表述为引用，不构成违规',evidence:[2]}},now);
 const saved=entity(s,f.id);assert.equal(alertCategory(saved),'closed');assert.deepEqual(saved.evidence,evidence);assert.equal(saved.callId,f.callId);assert.equal(latest(saved).value,'false_positive');assert.ok(!actions(s,f.id).includes('followup'));assert.ok(actions(s,f.id).includes('optimization_feedback'));
 assert.deepEqual(alertTabs.map(t=>t[1]),['待处理','核实中','已分发','误报归档','全部预警']);
 assert.equal(alertCategory(entity(JSON.parse(JSON.stringify(s)),f.id)),'closed');
});
test('problem history follows only linked tasks, including supplements, not other problems on the call',()=>{
 const s=createInitial(now),f=s.findings.find(f=>f.id==='F-1039'),other={...structuredClone(f),id:'F-OTHER'};s.findings.push(other);
 s.remedies.push({...structuredClone(s.remedies[0]),id:'R-OWN',findingId:f.id},{...structuredClone(s.remedies[0]),id:'R-OTHER',findingId:other.id});
 const logs=[['own',f.id],['own-remedy','R-OWN'],['other',other.id],['other-remedy','R-OTHER']].map(([id,target])=>({id,target,callId:f.callId,at:now.toISOString(),actor:'S01',action:'处理',note:id}));s.logs.push(...logs);
 const result=problemLogs(s,[f.id]);assert.ok(result.some(l=>l.id==='own-remedy'));assert.ok(!result.some(l=>l.id==='other'||l.id==='other-remedy'));
 assert.ok(problemRecords(s,[f.id]).some(r=>r.id==='R-OWN'));assert.ok(!problemRecords(s,[f.id]).some(r=>r.id==='R-OTHER'));
});
