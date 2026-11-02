export function recordingTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(total / 60), remainder = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}
export function evidenceClipRange(transcript: { at: number }[], index: number, callDuration: number, audioDuration?: number) {
  const segment = transcript[index];
  if (!segment || !Number.isFinite(segment.at) || segment.at < 0) return undefined;
  const limit = audioDuration && Number.isFinite(audioDuration) ? audioDuration : callDuration;
  const next = transcript.slice(index + 1).find(item => item.at > segment.at)?.at;
  const end = Math.min(next ?? limit, limit);
  return Number.isFinite(end) && end > segment.at ? { start: segment.at, end } : undefined;
}
