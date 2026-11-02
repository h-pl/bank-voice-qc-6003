import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { recordingSource } from '../lib/recording-timeline.ts';
import { createPrototypeState } from '../lib/prototype-seeds.ts';
import recordings from '../lib/review-recordings.json' with { type: 'json' };

test('review recordings cover current and legacy review fixtures without replacing existing audio', () => {
  const now = new Date('2026-10-08T12:00:00+08:00');
  const states = [createPrototypeState(now)];
  for (const state of states) {
    for (const review of state.reviews) {
      const call = state.calls.find(call => call.id === review.callId);
      if (!call?.transcript.length) continue;
      assert.ok(recordingSource(call), `${review.id}: ${call.id}`);
      if (call.audio) assert.equal(recordingSource(call).src, call.audio);
    }
  }
});

test('review recordings require exact call, text, role and timestamp bindings', () => {
  for (const item of recordings) {
    for (const id of item.callIds) assert.equal(recordingSource({ id, transcript: item.transcript }).src, item.src);
    const call = { id: item.callIds[0], transcript: item.transcript };
    assert.equal(recordingSource({ ...call, id: 'CALL-UNKNOWN' }), undefined);
    assert.equal(recordingSource({ ...call, audio: '/uploaded.wav' }).src, '/uploaded.wav');
    for (const change of [{ text: '已编辑原话' }, { speaker: 'unknown' }, { at: 0.1 }]) {
      const transcript = structuredClone(item.transcript);
      Object.assign(transcript[0], change);
      assert.equal(recordingSource({ ...call, transcript }), undefined);
    }
  }
  const sameId = recordings.filter(item => item.callIds.includes('CALL-1039'));
  assert.equal(sameId.length, 2);
  assert.notEqual(sameId[0].src, sameId[1].src);
});

test('review audio files contain aligned two-voice PCM and waveform reflects real samples', () => {
  for (const item of recordings) {
    const file = readFileSync(new URL(`../public${item.src}`, import.meta.url));
    assert.equal(file.toString('ascii', 0, 4), 'RIFF');
    assert.equal(file.toString('ascii', 8, 12), 'WAVE');
    assert.equal(file.readUInt16LE(22), 1);
    assert.equal(file.readUInt32LE(24), 22050);
    assert.equal(file.readUInt16LE(34), 16);
    assert.equal(file.toString('ascii', 36, 40), 'data');
    const pcm = file.subarray(44);
    assert.equal(pcm.length / 44100, item.duration);
    assert.ok(item.src.includes(createHash('sha256').update(pcm).digest('hex').slice(0, 16)));
    assert.notEqual(item.voices.agent, item.voices.customer);
    item.timings.forEach((timing, index) => {
      const segment = item.transcript[index];
      assert.equal(timing.at, segment.at);
      assert.equal(timing.end, item.transcript[index + 1]?.at ?? item.duration);
      assert.equal(timing.voice, item.voices[segment.speaker]);
      assert.ok(timing.speechDuration > 0 && timing.speechDuration < timing.end - timing.at);
      const speech = pcm.subarray(Math.round(timing.at * 22050) * 2, Math.round((timing.at + timing.speechDuration) * 22050) * 2);
      assert.ok(speech.some(value => value !== 0));
    });
    const peaks = Array.from({ length: 160 }, (_, bucket) => {
      let max = 0;
      for (let i = Math.floor(pcm.length / 2 * bucket / 160); i < Math.floor(pcm.length / 2 * (bucket + 1) / 160); i++) max = Math.max(max, Math.abs(pcm.readInt16LE(i * 2)));
      return max;
    });
    const max = Math.max(...peaks);
    assert.ok(max > 0);
    assert.deepEqual(item.waveform, peaks.map(value => Number((value / max).toFixed(3))));
  }
});
