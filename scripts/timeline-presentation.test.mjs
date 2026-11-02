import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrototypeState} from '../lib/prototype-seeds.ts';
import {businessRecordText,timelineReferences} from '../lib/timeline-presentation.ts';
import {problemLogs} from '../lib/alert-records.ts';
import {canSee,entity,people} from '../lib/workflow.ts';
const seed=()=>createPrototypeState(new Date('2026-09-27T05:00:00Z'));
test('records link to their real appeal/review and problem, not sibling call issues',()=>{
 const s=seed();const review=s.reviews.find(r=>r.type==='appeal'&&r.findingIds.length);
 const refs=timelineReferences(s,review.id);
 assert.deepEqual(refs.map(r=>r.id),[review.id,...review.findingIds]);
 assert.equal(refs[0].label,'申诉核查工单');
 for(const log of problemLogs(s,review.findingIds)){
  const refs=timelineReferences(s,log.target);
  assert.equal(refs[0]?.id,log.target);
  assert.ok(refs.every(r=>entity(s,r.id)&&canSee(s,r.id)));
 }
 const unrelated=s.findings.find(f=>!review.findingIds.includes(f.id));
 assert.ok(!refs.some(r=>r.id===unrelated.id));
});
test('inaccessible and missing event targets do not create navigation links',()=>{
 const s=seed();s.identity=people.find(p=>p.role==='agent').id;
 const hidden=s.reviews.find(r=>!canSee(s,r.id));assert.ok(hidden);
 assert.deepEqual(timelineReferences(s,hidden.id),[]);
 assert.deepEqual(timelineReferences(s,'WO-NOT-FOUND'),[]);
});
test('legacy generated revision labels stay internal without damaging IDs or business numbers',()=>{
 assert.equal(businessRecordText('身份核验流程预警 · V1；有效检出 1 次'),'身份核验流程预警；有效检出 1 次');
 assert.equal(businessRecordText('结论 V2 · 风险成立'),'结论 · 风险成立');
 assert.equal(businessRecordText('已保留原结论版本与申诉证据'),'已保留原结论与申诉证据');
 assert.equal(businessRecordText('策略 v2.1 · 已生效'),'策略 · 已生效');
 assert.equal(businessRecordText('禁用词库 V12 已用于后续检测；历史快照保留。'),'禁用词库 已用于后续检测；历史快照保留。');
 assert.equal(businessRecordText('服务规范：V1 → V2；核对内容'),'服务规范：引用已更新；核对内容');
 assert.equal(businessRecordText('服务规范：未引用 → V2；核对内容'),'服务规范：已关联引用；核对内容');
 const text='AP-V1 · 第 2 轮 · 15 秒 · 20% · 产品 V1 型号';
 assert.equal(businessRecordText(text),text);
 const s=seed(),before=structuredClone(s.logs);s.logs.forEach(log=>businessRecordText(log.note));assert.deepEqual(s.logs,before);
});
