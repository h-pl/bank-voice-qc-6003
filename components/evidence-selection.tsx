"use client";
import { useEffect, useId, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import type { Call } from '../lib/workflow';
import { evidenceClipRange, recordingTimestamp } from '../lib/evidence-clip';

export function EvidenceSelection({call,selected,onChange}:{call?:Call;selected:number[];onChange:(indices:number[])=>void}) {
  const [expanded,setExpanded]=useState(selected.length===0);
  const [active,setActive]=useState<number>();
  const [playing,setPlaying]=useState(false);
  const [current,setCurrent]=useState(0);
  const [duration,setDuration]=useState<number>();
  const [failed,setFailed]=useState(false);
  const audio=useRef<HTMLAudioElement>(null);
  const timer=useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bounds=useRef<{start:number;end:number} | undefined>(undefined);
  const request=useRef(0);
  const listId=useId();
  const transcript=call?.transcript ?? [];
  useEffect(()=>()=>{clearTimeout(timer.current);request.current++;},[]);
  const pause=()=>{clearTimeout(timer.current);audio.current?.pause();setPlaying(false);};
  const schedule=()=>{
    clearTimeout(timer.current);
    const media=audio.current,range=bounds.current;
    if(!media || !range || media.paused)return;
    timer.current=setTimeout(()=>{media.pause();media.currentTime=range.end;setCurrent(range.end);setPlaying(false);},Math.max(0,(range.end-media.currentTime)*1000));
  };
  const play=async(index:number)=>{
    const media=audio.current;
    if(!media || !call?.audio || failed)return;
    const range=evidenceClipRange(transcript,index,call.duration,duration);
    if(!range)return;
    if(active===index && playing){pause();return;}
    pause();bounds.current=range;setActive(index);
    if(active!==index || media.currentTime<range.start || media.currentTime>=range.end)media.currentTime=range.start;
    setCurrent(media.currentTime);
    const token=++request.current;
    try{await media.play();if(token===request.current){setPlaying(true);schedule();}}
    catch{if(token===request.current){setFailed(true);setPlaying(false);}}
  };
  const rows=expanded ? transcript.map((_,i)=>i) : [...selected].sort((a,b)=>a-b);
  return <section className="evidence-selection" aria-label="证据片段">
    <div className="evidence-selection-heading"><div className="evidence-selection-title"><span>证据片段 <small>已选 {selected.length}</small></span>{(!call?.audio || failed) && <span className="evidence-audio-status" role="status">{failed?'录音加载失败':'暂无可用录音'}</span>}</div><Button variant="link" type="button" className="text-button" aria-expanded={expanded} aria-controls={listId} onClick={()=>{pause();setExpanded(!expanded);}}>{expanded?'收起列表':'调整证据'}</Button></div>
    {call?.audio ? <audio ref={audio} src={call.audio} preload="metadata" onLoadedMetadata={event=>setDuration(event.currentTarget.duration)} onTimeUpdate={event=>{const media=event.currentTarget;setCurrent(media.currentTime);if(bounds.current && media.currentTime>=bounds.current.end)pause();}} onPlaying={schedule} onPause={()=>{clearTimeout(timer.current);setPlaying(false);}} onEnded={()=>{clearTimeout(timer.current);setPlaying(false);}} onError={()=>{pause();setFailed(true);}}/> : null}
    <div id={listId} className={expanded?'evidence-clip-options':'evidence-clip-summary'}>
      {rows.map(index=>{
        const segment=transcript[index];if(!segment)return null;
        const range=evidenceClipRange(transcript,index,call?.duration ?? 0,duration);
        const stamp=recordingTimestamp(segment.at);
        const isActive=active===index;
        return <div key={index} className="evidence-clip-row" data-selected={selected.includes(index)} data-selectable={expanded}>
          {expanded && <Checkbox id={`${listId}-${index}`} checked={selected.includes(index)} aria-label={`选择 ${stamp} ${segment.speaker==='agent'?'坐席':'客户'}证据`} onCheckedChange={checked=>onChange(checked===true?[...selected,index]:selected.filter(x=>x!==index))}/>}
          <time className="evidence-clip-time">{stamp}</time>
          <Badge variant="secondary" className="evidence-clip-role" data-speaker={segment.speaker}>{segment.speaker==='agent'?'坐席':'客户'}</Badge>
          {expanded?<Label htmlFor={`${listId}-${index}`} className="evidence-clip-text">{segment.text}</Label>:<p className="evidence-clip-text">{segment.text}</p>}
          <div className="evidence-clip-actions">
            {selected.includes(index) && <span className="evidence-clip-marker">证据</span>}
            {call?.audio && <Button type="button" variant="ghost" size="icon-sm" disabled={failed || !range} aria-label={`${isActive&&playing?'暂停':'播放'} ${stamp} 录音片段`} title={isActive&&playing?'暂停片段':'播放片段'} onClick={()=>void play(index)}>{isActive&&playing?<Pause size={14}/>:<Play size={14}/>}</Button>}
          </div>
          {isActive && range && <div className="evidence-clip-progress"><time>{recordingTimestamp(Math.max(range.start,current))}</time><Slider aria-label={`${stamp} 片段播放进度`} min={range.start} max={range.end} step={0.1} value={[Math.min(range.end,Math.max(range.start,current))]} onValueChange={value=>{if(audio.current){audio.current.currentTime=value[0];setCurrent(value[0]);schedule();}}}/><time>{recordingTimestamp(range.end)}</time></div>}
        </div>;
      })}
      {!rows.length && <p className="subtle">{transcript.length?'尚未选择证据片段':'暂无转写片段'}</p>}
    </div>
  </section>;
}
