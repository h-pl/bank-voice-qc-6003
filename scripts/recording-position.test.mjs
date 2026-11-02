import test from 'node:test';
import assert from 'node:assert/strict';
import { observeRecordingPosition } from '../lib/recording-position.ts';

function setup() {
  const media = Object.assign(new EventTarget(), { currentTime: 0, paused: true, ended: false, readyState: 4 });
  const pending = new Map(); let id = 0;
  const frames = { request: fn => { pending.set(++id, fn); return id; }, cancel: key => pending.delete(key) };
  const paints = [];
  const dispose = observeRecordingPosition(media, time => paints.push(time), frames);
  const emit = type => media.dispatchEvent(new Event(type));
  const frame = () => { const work = [...pending.values()]; pending.clear(); work.forEach(fn => fn()); };
  return { media, paints, pending, dispose, emit, frame };
}
test('progress follows every media-clock frame without timeupdate or elapsed-time extrapolation', () => {
  const s = setup(); s.media.paused = false; s.emit('playing');
  for (const time of [0.016, 0.033, 0.05, 0.05, 0.083]) { s.media.currentTime = time; s.frame(); assert.equal(s.paints.at(-1), time); }
  assert.equal(s.pending.size, 1); // repeated playing events cannot create duplicate loops
  s.emit('playing'); assert.equal(s.pending.size, 1); s.dispose();
});
test('paused seeks paint immediately and never start an animation loop', () => {
  const s = setup(); s.media.currentTime = 16; s.emit('seeking'); s.emit('seeked');
  assert.equal(s.paints.at(-1), 16); assert.equal(s.pending.size, 0);
  s.media.currentTime = 11; s.emit('seeked'); assert.equal(s.paints.at(-1), 11); s.dispose();
});
test('pause, buffering and end stop frame work; resume and rate changes use the actual clock', () => {
  const s = setup(); s.media.paused = false; s.emit('playing'); s.media.currentTime = 3.25;
  s.emit('waiting'); assert.equal(s.pending.size, 0); assert.equal(s.paints.at(-1), 3.25);
  s.emit('playing'); s.media.currentTime = 3.75; s.emit('ratechange'); s.frame(); assert.equal(s.paints.at(-1), 3.75);
  s.media.paused = true; s.emit('pause'); assert.equal(s.pending.size, 0);
  s.media.currentTime = 40; s.media.ended = true; s.emit('ended'); assert.equal(s.paints.at(-1), 40); assert.equal(s.pending.size, 0); s.dispose();
});
test('unmount or source replacement cancels frames and removes all media listeners', () => {
  const s = setup(); s.media.paused = false; s.emit('playing'); s.dispose();
  const count = s.paints.length;
  s.emit('playing'); s.emit('seeked'); s.emit('timeupdate'); s.frame();
  assert.equal(s.pending.size, 0); assert.equal(s.paints.length, count);
});
