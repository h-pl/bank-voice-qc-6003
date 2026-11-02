import sample from './recording-sample.json' with { type: 'json' };
import reviewRecordings from './review-recordings.json' with { type: 'json' };
import legacySample from './recording-legacy-sample.json' with { type: 'json' };

type RecordingCall = { id: string; audio?: string; transcript: { at: number; speaker: string; text: string }[] };

/** Only fill explicitly prepared fixture transcripts; never substitute speech for other or edited calls. */
export function recordingSource(call: RecordingCall) {
  if (call.audio) return { src: call.audio, synthetic: call.audio === '/audio/privacy-demo.m4a', duration: 0, waveform: [] as number[] };
  const signature = (transcript: RecordingCall['transcript']) => JSON.stringify(transcript.map(({ at, speaker, text }) => [at, speaker, text]));
  const matched = [sample, legacySample].find(item => call.id === item.callId && signature(call.transcript) === signature(item.transcript))
    ?? reviewRecordings.find(item => item.callIds.includes(call.id) && signature(call.transcript) === signature(item.transcript));
  if (!matched) return undefined;
  return { src: matched.src, synthetic: true, duration: matched.duration, waveform: matched.waveform };
}

export function recordingSegmentAt(transcript: { at: number }[], time: number, duration: number) {
  if (!Number.isFinite(time) || time < 0 || time >= duration) return -1;
  return transcript.findLastIndex((segment, index) => segment.at <= time && time < (transcript[index + 1]?.at ?? duration));
}

export function recordingRanges(transcript: { at: number }[], evidence: number[], duration: number) {
  return transcript.flatMap((segment, index) => {
    const end = Math.min(transcript[index + 1]?.at ?? duration, duration);
    return segment.at >= 0 && end > segment.at ? [{ index, start: segment.at, end, hit: evidence.includes(index) }] : [];
  });
}
