import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCalendarDate, calendarDateValue } from '../lib/date-picker-value.ts';
import { evidenceClipRange, recordingTimestamp } from '../lib/evidence-clip.ts';
test('calendar retains date-only and datetime values without UTC day shifts',()=>{
 for(const value of ['2026-09-24','2024-02-29','2026-12-31T23:59']) assert.equal(calendarDateValue(parseCalendarDate(value)),value.slice(0,10));
 for(const value of ['', '2026-02-29','2026-13-01','2026-09-31']) assert.equal(parseCalendarDate(value),undefined);
});
test('evidence timestamps carry minutes rather than raw seconds',()=>{
 assert.equal(recordingTimestamp(0),'00:00');assert.equal(recordingTimestamp(16),'00:16');assert.equal(recordingTimestamp(68),'01:08');assert.equal(recordingTimestamp(3672),'61:12');
});
test('evidence playback stops at next segment or actual audio end',()=>{
 const segments=[{at:0},{at:8},{at:16},{at:24},{at:32}];
 assert.deepEqual(evidenceClipRange(segments,2,310,31),{start:16,end:24});
 assert.deepEqual(evidenceClipRange(segments,3,310,31),{start:24,end:31});
 assert.equal(evidenceClipRange(segments,4,310,31),undefined);
 assert.equal(evidenceClipRange(segments,9,310),undefined);
 assert.deepEqual(evidenceClipRange(segments,4,40),{start:32,end:40});
});
