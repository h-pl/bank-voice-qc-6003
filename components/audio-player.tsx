"use client";
import { useEffect, useState, useRef, useImperativeHandle, useCallback, useMemo, type RefObject, type PointerEvent, type ReactNode } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { recordingTimestamp as clock } from "../lib/evidence-clip";
import { recordingRanges, recordingSegmentAt } from "../lib/recording-timeline";
import { observeRecordingPosition } from "../lib/recording-position";

export type RecordingController = { seek: (time: number) => void };
type Props = {
  controller: RefObject<RecordingController | null>;
  src: string; synthetic?: boolean; expectedDuration?: number; waveform?: number[];
  transcript: { at: number; speaker: string; text: string }[]; evidence: number[];
  navigation?: ReactNode;
  initialTime?: number; selected: number; hovered?: number;
  onTime: (time: number) => void; onPlaying: (playing: boolean) => void;
  onDuration: (duration: number) => void; onSeek: (time: number) => void; onHover: (index?: number) => void;
};

export function AudioPlayer({ controller, src, expectedDuration = 0, waveform = [], transcript, evidence, initialTime, selected, hovered, onTime, onPlaying, onDuration, onSeek, onHover, navigation }: Props) {
  const media = useRef<HTMLAudioElement>(null);
  const playhead = useRef<HTMLSpanElement>(null);
  const playedWaveform = useRef<HTMLDivElement>(null);
  const pendingSeek = useRef<number | undefined>(initialTime);
  const [playing, setPlaying] = useState(false), [current, setCurrent] = useState(initialTime ?? 0);
  const [duration, setDuration] = useState(expectedDuration), [ready, setReady] = useState(false);
  const [speed, setSpeed] = useState("1");
  const [error, setError] = useState(false), [waiting, setWaiting] = useState(false);
  const [hoverTime, setHoverTime] = useState<number>();
  const ranges = recordingRanges(transcript, evidence, duration);
  const waveformBars = useMemo(() => waveform.map((height, index) => {
    const time = (index + 0.5) / waveform.length * duration;
    const segment = recordingSegmentAt(transcript, time, duration);
    return { height, speaker: transcript[segment]?.speaker };
  }), [waveform, transcript, duration]);
  const paintPosition = useCallback((time: number) => {
    const percent = duration > 0 ? Math.max(0, Math.min(100, time / duration * 100)) : 0;
    if (playhead.current) playhead.current.style.transform = `translateX(${percent}%)`;
    if (playedWaveform.current) playedWaveform.current.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
  }, [duration]);
  const failed = () => { setError(true); setWaiting(false); setPlaying(false); onPlaying(false); };
  const updateTime = (time: number) => { paintPosition(time); setCurrent(time); onTime(time); };
  const seek = (time: number) => {
    const value = Math.min(duration || time, Math.max(0, time));
    if (media.current && media.current.readyState >= 1) media.current.currentTime = value;
    else pendingSeek.current = value;
    updateTime(value); onSeek(value);
  };
  useImperativeHandle(controller, () => ({ seek }));
  useEffect(() => {
    const element = media.current;
    const pauseHidden = () => { if (document.hidden) element?.pause(); };
    document.addEventListener("visibilitychange", pauseHidden);
    return () => { element?.pause(); document.removeEventListener("visibilitychange", pauseHidden); };
  }, []);
  useEffect(() => {
    const element = media.current;
    if (!element) return;
    return observeRecordingPosition(element, paintPosition);
  }, [src, paintPosition]);
  const play = () => {
    const element = media.current;
    if (!element) return;
    if (playing) element.pause();
    else { if (element.ended) seek(0); void element.play().catch(failed); }
  };
  const hoverAxis = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || !duration) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const time = Math.max(0, Math.min(duration, (event.clientX - bounds.left) / bounds.width * duration));
    setHoverTime(time); onHover(recordingSegmentAt(transcript, time, duration));
  };
  const clearHover = () => { setHoverTime(undefined); onHover(undefined); };
  const ticks = [0, duration];
  return <section className="recording-player recording-player-linked" aria-label="通话录音播放器">
    <audio ref={media} data-qc-recording src={src} preload="metadata"
      onLoadedMetadata={event => {
        const element = event.currentTarget;
        const length = Number.isFinite(element.duration) ? element.duration : 0;
        setDuration(length); onDuration(length); setReady(length > 0); setError(false);
        if (pendingSeek.current !== undefined) {
          const time = Math.min(length, pendingSeek.current);
          element.currentTime = time; updateTime(time); pendingSeek.current = undefined;
        }
      }}
      onPlay={event => {
        document.querySelectorAll<HTMLAudioElement>("audio[data-qc-recording]").forEach(other => { if (other !== event.currentTarget) other.pause(); });
        setPlaying(true); onPlaying(true); updateTime(event.currentTarget.currentTime);
      }}
      onPause={event => { setPlaying(false); onPlaying(false); updateTime(event.currentTarget.currentTime); }}
      onEnded={event => { setPlaying(false); onPlaying(false); updateTime(event.currentTarget.currentTime); }} onError={failed}
      onWaiting={() => setWaiting(true)} onPlaying={() => setWaiting(false)}
      onSeeked={event => updateTime(event.currentTarget.currentTime)}
      onTimeUpdate={event => updateTime(event.currentTarget.currentTime)}/>
    {waiting && !error && <small className="recording-buffering" role="status">正在缓冲…</small>}
    <div className="recording-controls">
      <Button type="button" variant="outline" className="recording-play" size="icon" title={playing ? "暂停录音" : "播放录音"} aria-label={playing ? "暂停录音" : "播放录音"} disabled={!ready || error} onClick={play}>{playing ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>}</Button>
      <Button type="button" variant="outline" className="recording-rewind" size="icon" title="后退 5 秒" aria-label="后退 5 秒" disabled={!ready || error} onClick={() => seek(current - 5)}><RotateCcw aria-hidden="true"/></Button>
      <span className="recording-time" aria-label={`当前 ${clock(current)}，总时长 ${clock(duration)}`}>{clock(current)}<span> / {clock(duration)}</span></span>
      <div className="recording-options">{navigation}
        <Select value={speed} onValueChange={value => { setSpeed(value); if (media.current) media.current.playbackRate = Number(value); }}><SelectTrigger aria-label="播放倍速" className="recording-speed"><SelectValue/></SelectTrigger><SelectContent>{["0.75", "1", "1.25", "1.5", "2"].map(value => <SelectItem key={value} value={value}>{value}×</SelectItem>)}</SelectContent></Select>
      </div>
    </div>
    <div className="recording-timeline">
      <div className="recording-axis" onPointerMove={hoverAxis} onPointerLeave={clearHover}>
        <div className="recording-regions" aria-hidden="true">{ranges.map(range => <span key={range.index} data-hit={range.hit} data-selected={selected === range.index} data-hovered={hovered === range.index} style={{ left: `${range.start / duration * 100}%`, width: `${(range.end - range.start) / duration * 100}%` }}/>)}</div>
        {waveform.length ? <>
          <div className="recording-waveform" aria-hidden="true">{waveformBars.map(({ height, speaker }, index) => <span key={index} data-speaker={speaker} style={{ height: `${Math.max(2, height * 42)}px` }}/>)}</div>
          <div ref={playedWaveform} className="recording-waveform recording-waveform-played" aria-hidden="true">{waveformBars.map(({ height, speaker }, index) => <span key={index} data-speaker={speaker} style={{ height: `${Math.max(2, height * 42)}px` }}/>)}</div>
        </> : <div className="recording-axis-baseline" aria-hidden="true"/>}
        <Slider className="recording-wave-slider" aria-label="录音播放进度" aria-valuetext={`${clock(current)} / ${clock(duration)}`} disabled={!ready || error} min={0} max={duration || 1} step={0.1} value={[Math.min(current, duration || 0)]} onValueChange={value => seek(value[0])}/>
        <span className="recording-playhead-track" aria-hidden="true"><span ref={playhead} className="recording-playhead"/></span>
        {hoverTime !== undefined && <span className="recording-axis-hover" aria-hidden="true" style={{ left: `${Math.max(6, Math.min(94, hoverTime / duration * 100))}%` }}>{clock(hoverTime)}</span>}
      </div>
      <div className="recording-axis-ticks" aria-hidden="true">{ticks.map((time, index) => <span key={index}>{clock(time)}</span>)}</div>
    </div>
    {error ? <p className="recording-hint recording-error" role="alert">录音暂不可用，可继续查看转写。<Button type="button" variant="link" onClick={() => { setError(false); setWaiting(true); media.current?.load(); }}>重新加载</Button></p> : null}
  </section>;
}
