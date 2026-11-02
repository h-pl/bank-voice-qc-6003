import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitial } from '../lib/fixtures.ts';
import { canSee } from '../lib/workflow.ts';
import { callTriggers } from '../lib/call-triggers.ts';

function scenario() {
  const state = createInitial(new Date('2026-09-23T10:00:00+08:00'));
  const call = state.calls.find(c => c.batches.at(-1)?.checks.every(check => check.state === 'success'));
  const base = state.findings[0];
  const finding = (id, ruleId, indicator, extra = {}) => ({ ...structuredClone(base), hits: undefined, id, callId: call.id, batchId: call.batches.at(-1).id, source: 'auto', ruleId, indicator, ...extra });
  return { state, call, finding };
}

test('a call aggregates multiple rules under the same indicator without counting repeated hits twice', () => {
  const { call, finding } = scenario();
  const findings = [finding('a', 'rule-a', '6.3.7'), finding('b', 'rule-a', '6.3.7'), finding('c', 'rule-b', '6.3.7'), finding('d', 'rule-c', '6.3.8')];
  assert.deepEqual(callTriggers(call, findings), { ruleCount: 3, indicatorCount: 2, complete: true });
});

test('rechecks, manual discoveries and other calls do not inflate automatic trigger counts; archived hits remain', () => {
  const { call, finding } = scenario();
  const findings = [finding('a', 'rule-a', '6.3.7', { status: 'closed', conclusions: [{ value: 'false_positive' }] }), finding('b', 'old', '6.3.8', { batchId: 'old-batch' }), finding('c', 'manual', '6.3.9', { source: 'manual' }), finding('d', 'other', '6.2.5', { callId: 'other-call' })];
  assert.deepEqual(callTriggers(call, findings), { ruleCount: 1, indicatorCount: 1, complete: true });
});

test('completed zero, incomplete unknown and provisional hits are distinct', () => {
  const { call, finding } = scenario();
  assert.deepEqual(callTriggers(call, []), { ruleCount: 0, indicatorCount: 0, complete: true });
  for (const state of ['pending', 'running', 'failed']) {
    call.batches.at(-1).checks.forEach(check => { check.state = state; });
    assert.deepEqual(callTriggers(call, []), { ruleCount: null, indicatorCount: null, complete: false });
    assert.deepEqual(callTriggers(call, [finding('a', 'rule-a', '6.3.7')]), { ruleCount: 1, indicatorCount: 1, complete: false });
  }
});

test('agent counts use only visible findings', () => {
  const { state, call, finding } = scenario();
  state.identity = call.agentId;
  state.findings = [finding('visible', 'rule-a', '6.3.7', { conclusions: [{ value: 'risk' }] }), finding('hidden', 'rule-b', '6.3.8', { conclusions: [], reminder: undefined })];
  assert.deepEqual(callTriggers(call, state.findings.filter(f => canSee(state, f.id))), { ruleCount: 1, indicatorCount: 1, complete: true });
});
