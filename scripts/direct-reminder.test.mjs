import test from 'node:test';
import assert from 'node:assert/strict';
import { directReminderInput } from '../lib/direct-reminder.ts';
import { createInitial } from '../lib/fixtures.ts';
import { apply, entity, latest, callFor } from '../lib/workflow.ts';
const now = new Date('2026-09-24T10:00:00+08:00');
const draft = { content: '  停止索取银行卡密码  ', standard: '按核验流程确认身份并提交同业务样例', dueAt: '2026-09-26T10:00:00+08:00', evidence: [2], sampleCount: 2, observation: '核对身份验证步骤及信息保护话术' };
function dispatch(state, input = directReminderInput(draft), overrides = {}) {
  return apply(state, { id: 'F-1037', action: 'dispatch', rev: entity(state, 'F-1037').rev, requestId: 'direct-reminder-test', input, ...overrides }, now);
}
test('reminder preserves explicit requirements and audit text through acceptance', () => {
  const state = createInitial(now), input = directReminderInput(draft);
  const next = dispatch(state, input), finding = entity(next, 'F-1037');
  assert.equal(finding.distribution.status, 'pending');
  assert.equal(next.remedies.length, state.remedies.length);
  assert.equal(latest(finding).note, '提醒内容：停止索取银行卡密码\n完成要求：按核验流程确认身份并提交同业务样例');
  assert.deepEqual(latest(finding).evidence, [2]);
  assert.notEqual(input.evidence, draft.evidence);
  const accepted = apply({ ...next, identity: callFor(next, finding.id).agentId }, { id: finding.id, action: 'accept_result', rev: finding.rev, requestId: 'accept-reminder-test', input: {} }, now);
  const remedy = accepted.remedies.at(-1);
  for (const key of ['goal', 'standard', 'dueAt', 'sampleCount', 'observation']) assert.deepEqual(remedy[key], input[key]);
  assert.equal(remedy.inspector, '');
  assert.equal(entity(state, finding.id).distribution, undefined);
});
test('reminder rejects incomplete requirements and invalid verification parameters', () => {
  for (const patch of [{content:''}, {content:'问题'}, {standard:'   '}, {standard:'完成'}, {sampleCount:0}, {sampleCount:21}, {sampleCount:1.5}, {observation:' '}]) {
    assert.throws(() => directReminderInput({...draft, ...patch}));
  }
});
test('reminder retains evidence, deadline, permission and revision guards atomically', () => {
  const state = createInitial(now), before = structuredClone(state);
  for (const patch of [{evidence:[]}, {dueAt:'2026-09-23T10:00:00+08:00'}]) assert.throws(() => dispatch(state, {...directReminderInput(draft), ...patch}));
  assert.throws(() => dispatch({...state, identity:'A1048'}));
  assert.throws(() => dispatch(state, directReminderInput(draft), {rev:entity(state,'F-1037').rev+1}));
  assert.deepEqual(state,before);
});
