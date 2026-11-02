// Historical records issued before the 2026-09-22 distribution/acceptance change.
// Used only to regression-test existing materials, appeals and persisted drafts.
// New issuance is tested through real commands in current-flow.test.mjs.
import {legacyInitial as createInitial} from './legacy-initial.mjs';
export function legacyIssued(now, dueAt, sampleCount=1) {
  const s=createInitial(now),r=s.reviews.find(r=>r.id==='WO-1039');
  for(const fid of r.findingIds){const f=s.findings.find(f=>f.id===fid),op=r.opinions[fid];f.conclusions.push({sequence:1,value:op.value,note:op.note,at:now.toISOString(),by:'S01',reviewer:r.owner,evidence:op.evidence,ruleVersion:f.ruleVersion,batchId:f.batchId});f.status='delivered';}
  r.status='done';r.finishedAt=now.toISOString();
  const rec={id:'REC-LEGACY-1039',rev:0,findingId:'F-1039',conclusionSequence:1,agentId:'A1048',inspector:'Q01',status:'pending',goal:'改善服务表达',standard:'完整说明业务条件，避免消极表达',standardSequence:1,sampleCount,observation:'整改后同业务样例',dueAt,originalDueAt:dueAt,createdAt:now.toISOString(),round:1,materials:[],acceptanceHistory:[],pauseHistory:[],standards:[]};
  rec.standards.push({sequence:1,goal:rec.goal,standard:rec.standard,note:'历史直接下发整改',at:now.toISOString()});s.remedies.push(rec);return s;
}
