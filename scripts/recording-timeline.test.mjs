import test from 'node:test';
import assert from 'node:assert/strict';
import { recordingSource, recordingSegmentAt, recordingRanges } from '../lib/recording-timeline.ts';
import sample from '../lib/recording-sample.json' with { type: 'json' };
import legacySample from '../lib/recording-legacy-sample.json' with { type: 'json' };

test('synthetic recording only matches the authorized original transcript and never replaces audio', () => {
  const call = { id: sample.callId, transcript: structuredClone(sample.transcript) };
  assert.equal(recordingSource(call).src, sample.src);
  assert.equal(recordingSource({ id: legacySample.callId, transcript: legacySample.transcript }).src, legacySample.src);
  assert.equal(recordingSource({ ...call, id: 'CALL-UNRELATED' }), undefined);
  assert.equal(recordingSource({ ...call, audio: '/uploaded.wav' }).src, '/uploaded.wav');
  call.transcript[2].text = '修改后的业务原话';
  assert.equal(recordingSource(call), undefined);
});
test('playback selection changes on exact boundaries, handles silence and stops at the end', () => {
  const transcript = [{ at: 0 }, { at: 8 }, { at: 16 }, { at: 24 }, { at: 32 }];
  assert.equal(recordingSegmentAt(transcript, 15.99, 40), 1);
  assert.equal(recordingSegmentAt(transcript, 16, 40), 2);
  assert.equal(recordingSegmentAt(transcript, 39.99, 40), 4);
  assert.equal(recordingSegmentAt(transcript, 40, 40), -1);
  assert.equal(recordingSegmentAt(transcript, NaN, 40), -1);
  assert.equal(recordingSegmentAt([], 2, 40), -1);
  assert.equal(recordingSegmentAt([{ at: 8 }], 2, 40), -1);
});
test('hit intervals use the real media length and do not create ranges outside the recording', () => {
  assert.deepEqual(recordingRanges([{ at: 0 }, { at: 8 }, { at: 16 }, { at: 24 }], [2, 3, 99], 20), [
    { index: 0, start: 0, end: 8, hit: false }, { index: 1, start: 8, end: 16, hit: false },
    { index: 2, start: 16, end: 20, hit: true },
  ]);
  assert.deepEqual(recordingRanges([{ at: 0 }], [0], 0), []);
  assert.equal(sample.waveform.length, 160);
  assert.ok(sample.waveform.some(value => value > 0));
  assert.ok(sample.waveform.every(value => value >= 0 && value <= 1));
});
