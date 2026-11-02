"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { revealTranscriptRow } from "../lib/transcript-scroll";
import type { Call } from "../lib/workflow";
import { recordingSource, recordingSegmentAt } from "../lib/recording-timeline";
import { recordingTimestamp as clock } from "../lib/evidence-clip";
import { AudioPlayer, type RecordingController } from "./audio-player";
import { EvidenceNavigation } from "./evidence-navigation";
import { Button } from "./ui";
import { Headphones } from "lucide-react";

export function EvidenceRecording({ call, evidence, initialSegment, children, afterTranscript }: {
  call: Call; evidence: number[]; initialSegment?: number; children?: ReactNode; afterTranscript?: ReactNode;
}) {
  const source = recordingSource(call);
  const controller = useRef<RecordingController>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(call.transcript[initialSegment ?? -1]?.at ?? 0);
  const [positioned, setPositioned] = useState(initialSegment !== undefined);
  const [duration, setDuration] = useState(source?.duration || call.duration);
  const [playing, setPlaying] = useState(false), [hovered, setHovered] = useState<number>();
  const [corrected, setCorrected] = useState(false);
  const segments = call.transcript.flatMap((_, index) => evidence.includes(index) ? [index] : []);
  const [lastEvidence, setLastEvidence] = useState(segments.includes(initialSegment ?? -1) ? initialSegment! : segments[0]);
  const updatePosition = (time: number) => {
    setCurrent(time); setPositioned(true);
    const index = recordingSegmentAt(call.transcript, time, duration);
    if (segments.includes(index)) setLastEvidence(index);
  };
  const selected = positioned ? recordingSegmentAt(call.transcript, current, duration) : -1;
  const locate = (time: number) => {
    updatePosition(time);
    const index = recordingSegmentAt(call.transcript, time, duration);
    revealTranscriptRow(transcriptRef.current?.children[index]);
  };
  useEffect(() => {
    if (playing && selected >= 0) revealTranscriptRow(transcriptRef.current?.children[selected]);
  }, [playing, selected]);
  useEffect(() => {
    if (initialSegment !== undefined) transcriptRef.current?.children[initialSegment]?.scrollIntoView({ block: "nearest" });
  }, [initialSegment]);
  const select = (index: number) => {
    const time = call.transcript[index].at;
    if (source) controller.current?.seek(time);
    else locate(time);
  };
  const navigation = <EvidenceNavigation key={segments.join(",")} transcriptRef={transcriptRef} segments={segments} current={lastEvidence} onLocate={select}/>;
  return <>
    {source ? <AudioPlayer controller={controller} {...source} expectedDuration={source.duration} transcript={call.transcript} evidence={segments} initialTime={call.transcript[initialSegment ?? -1]?.at} selected={selected} hovered={hovered} onTime={updatePosition} onPlaying={setPlaying} onDuration={setDuration} onSeek={locate} onHover={setHovered} navigation={navigation}/> : <div className="recording-unavailable" role="status"><Headphones size={18} aria-hidden="true"/><span>暂无可用音频</span></div>}
    {children}
    {!source && navigation}
    {!!call.corrections?.length && <div className="correction-toggle"><Button onClick={() => setCorrected(!corrected)}>{corrected ? "查看原始转写" : "查看修订对照"}</Button><small>修订独立保留，不覆盖原文</small></div>}
    {!call.transcript.length && <p className="evidence-empty" role="status">暂无通话转写</p>}
    <div className="transcript transcript-linked" ref={transcriptRef} role="region" aria-label={afterTranscript ? "通话转写与依据" : "通话转写内容"} tabIndex={0}>
      {call.transcript.map((segment, index) => <button type="button" key={index} className={`utterance ${segments.includes(index) ? "hit" : ""}`} aria-label={`${source ? "定位到" : "选择片段"} ${clock(segment.at)} ${segment.speaker === "agent" ? "坐席" : "客户"}${segments.includes(index) ? "，命中片段" : ""}`} aria-pressed={selected === index} data-selected={selected === index} data-hovered={hovered === index} data-playing={selected === index && playing} onClick={() => select(index)} onPointerEnter={() => setHovered(index)} onPointerLeave={() => setHovered(undefined)} onFocus={() => setHovered(index)} onBlur={() => setHovered(undefined)}>
        <span className="utterance-meta">
          <span className="timecode">{clock(segment.at)}</span>
          <span className={`speaker ${segment.speaker}`}>{segment.speaker === "agent" ? "坐席" : "客户"}</span>
          {segments.includes(index) && <span className="hit-label">命中</span>}
        </span>
        <span className="utterance-text">{corrected ? call.corrections?.find(correction => correction.segment === index)?.text ?? segment.text : segment.text}
          {corrected && call.corrections?.some(correction => correction.segment === index) && <small className="correction-original">原文：{segment.text}<br/>{call.corrections.find(correction => correction.segment === index)?.reason}</small>}
        </span>
      </button>)}
      {afterTranscript}
    </div>
  </>;
}
