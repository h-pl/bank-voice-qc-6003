import test from 'node:test';
import assert from 'node:assert/strict';
import { splitLegacyReviews } from '../lib/single-problem-reviews.ts';
import { createPrototypeState } from '../lib/prototype-seeds.ts';
import { apply, actions, entity, linkableFindings } from '../lib/workflow.ts';
import { problemLogs } from '../lib/alert-records.ts';
const now = new Date('2026-10-08T10:00:00Z');
function legacy() {
  const s = createPrototypeState(now);
  const first = entity(s, 'WO-1039'), second = entity(s, 'WO-1039-B');
  s.reviews = s.reviews.filter(r => r.id !== second.id);
  first.findingIds.push(second.findingIds[0]);
  first.rev = 5;
  first.opinions['F-1039-B'] = { value:'false_positive',note:'另一问题的独立理由，不得串用',evidence:[4] };
  first.history.push({at:now.toISOString(),opinions:structuredClone(first.opinions),summary:'已核对两个问题'});
  first.dueAt = '2026-09-21T00:00:00Z';
  first.firstOverdueAt = first.dueAt;
  s.requests.push('saved-user-command');
  s.logs.push({id:'USER-SUBMIT',target:first.id,actor:'Q02',at:now.toISOString(),action:'提交复核意见',note:'原始共同提交记录'});
  return s;
}
const command = (s, id, action, input={}) => apply(s, {id,rev:entity(s,id).rev,action,requestId:'test-'+action,input}, now);

test('legacy split preserves all user progress, opinion ownership, exact archive and is idempotent', () => {
  const s=legacy(), before=structuredClone(s), original=entity(s,'WO-1039');
  const next=splitLegacyReviews(s,now), parts=next.reviews.filter(r=>r.id==='WO-1039'||r.id.startsWith('WO-1039-S'));
  assert.deepEqual(s,before);
  assert.equal(parts.length,2);
  for (const r of parts) {
    assert.equal(r.findingIds.length,1);
    assert.deepEqual(r.opinions[r.findingIds[0]],original.opinions[r.findingIds[0]]);
    assert.ok(Object.keys(r.opinions).every(id=>r.findingIds.includes(id)));
    assert.ok(r.history.every(h=>Object.keys(h.opinions).every(id=>r.findingIds.includes(id))));
    for (const key of ['status','owner','dueAt','originalDueAt','firstOverdueAt','summary','scope']) assert.deepEqual(r[key],original[key]);
    assert.equal(r.rev,original.rev+1);
  }
  assert.deepEqual(next.findings,s.findings);
  assert.deepEqual(next.calls,s.calls);
  assert.deepEqual(next.requests,s.requests);
  assert.deepEqual(next.reviewSplits.at(-1).source,original);
  assert.equal(splitLegacyReviews(next,now),next);
  assert.equal(next.logs.find(l=>l.id==='USER-SUBMIT').target,original.id);
  assert.ok(problemLogs(next,['F-1039-B']).some(l=>l.id==='USER-SUBMIT'&&l.target===parts[1].id));
});

test('split remaps appeal back references, independent supplement progress and preserves inherited audit', () => {
  const s=legacy(), review=entity(s,'WO-1039');
  const ap=structuredClone(s.appeals[0]);
  ap.id='AP-SPLIT';ap.findingId='F-1039-B';ap.reviewId=review.id;ap.status='reviewing';
  s.appeals.push(ap);review.type='appeal';review.appealId=ap.id;
  s.supplements.push({id:'SUP-SHARED',rev:3,target:review.id,executor:'A1048',dueAt:review.dueAt,note:'完整通话受理记录',status:'submitted',reply:'已上传业务回执',origin:'review',trigger:'接收后核实'});
  s.logs.push({id:'SUP-REPLY',target:'SUP-SHARED',at:now.toISOString(),actor:'A1048',action:'提交补充材料',note:'已上传业务回执'});
  const next=splitLegacyReviews(s,now), part=next.reviews.find(r=>r.id!==review.id&&r.findingIds[0]==='F-1039-B');
  assert.equal(entity(next,'AP-SPLIT').reviewId,part.id);
  assert.equal(part.appealId,'AP-SPLIT');assert.equal(entity(next,review.id).appealId,undefined);
  const copied=next.supplements.find(sp=>sp.target===part.id);
  assert.equal(copied.reply,'已上传业务回执');assert.equal(copied.status,'submitted');assert.equal(copied.splitFrom,'SUP-SHARED');
  copied.status='done';assert.equal(entity(next,'SUP-SHARED').status,'submitted');
  assert.ok(problemLogs(next,['F-1039-B']).some(l=>l.id==='SUP-REPLY'&&l.target===copied.id));
});

test('split handles occupied IDs, completed records and missing linked findings without dropping data', () => {
  const s=legacy(), r=entity(s,'WO-1039');r.status='done';r.finishedAt=now.toISOString();
  s.reviews.push({...structuredClone(r),id:'WO-1039-S2',findingIds:['F-1039'],opinions:{}});
  r.findingIds.push('F-MISSING');
  const next=splitLegacyReviews(s,now), parts=next.reviewSplits.at(-1).parts;
  assert.equal(new Set(next.reviews.map(r=>r.id)).size,next.reviews.length);
  assert.equal(parts.length,3);
  assert.ok(parts.every(p=>entity(next,p.reviewId).status==='done'));
  assert.equal(entity(next,parts[2].reviewId).findingIds[0],'F-MISSING');
  assert.equal(entity(next,parts[1].reviewId).finishedAt,r.finishedAt);
});

test('raw multi-problem work order cannot be saved or published, and stale pre-split forms fail', () => {
  const s=legacy();
  assert.deepEqual(actions(s,'WO-1039'),[]);
  assert.throws(()=>command(s,'WO-1039','publish',{}),/只能处理一个问题/);
  const next=splitLegacyReviews(s,now);
  assert.throws(()=>apply(next,{id:'WO-1039',rev:5,action:'publish',requestId:'stale',input:{}},now),/记录已更新/);
});

test('save and publish reject foreign opinions/dispositions; independent publish never completes its sibling', () => {
  const s=splitLegacyReviews(legacy(),now), r=entity(s,'WO-1039');
  r.status='working';s.identity=r.owner;
  const good=structuredClone(r.opinions), other={...good,'F-1039-B':{value:'risk',note:'不能存入其他问题',evidence:[4]}};
  assert.throws(()=>command(s,r.id,'save_review',{opinions:other}),/当前工单/);
  const saved=command(s,r.id,'save_review',{opinions:good});
  const submitted=command(saved,r.id,'submit_review',{opinions:good});submitted.identity='S01';
  assert.throws(()=>command(submitted,r.id,'publish',{dispositions:{'F-1039-B':{}}}),/当前工单/);
  const sibling=submitted.reviews.find(x=>x.id.startsWith('WO-1039-S'));
  const before=structuredClone(sibling), secondFinding=structuredClone(entity(submitted,'F-1039-B'));
  const done=command(submitted,r.id,'publish',{goal:'改善表达',standard:'明确说明后续渠道',observation:'同业务样例',sampleCount:1,dueAt:'2026-10-10T00:00:00Z'});
  assert.equal(entity(done,r.id).status,'done');
  assert.deepEqual(entity(done,sibling.id),before);assert.deepEqual(entity(done,'F-1039-B'),secondFinding);
});

test('bound spotchecks cannot append or link a second finding; fresh and zero-problem seeds remain valid', () => {
  const s=createPrototypeState(now);
  assert.ok(s.reviews.every(r=>r.findingIds.length<=1));
  assert.equal(splitLegacyReviews(s,now),s);
  const r=entity(s,'WO-SPOT-4');r.status='working';s.identity=r.owner;
  assert.ok(!actions(s,r.id).includes('add_finding'));
  assert.ok(!actions(s,r.id).includes('link_finding'));
  assert.deepEqual(linkableFindings(s,r),[]);
  assert.throws(()=>command(s,r.id,'add_finding',{title:'第二个问题',ruleId:'R-SVC-009',note:'另行登记',evidence:[2]}),/不允许/);
  assert.throws(()=>command(s,r.id,'link_finding',{findingId:'F-1041',note:'另行关联'}),/不允许/);
  const empty=entity(s,'WO-SPOT-1');s.identity=empty.owner;
  assert.ok(actions(s,empty.id).includes('add_finding'));
});
