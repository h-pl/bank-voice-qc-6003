'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AudioLines, Maximize2, Minus, PhoneCall, PhoneOff, Upload, X } from 'lucide-react';
import styles from './call-demo.module.css';
import { Button } from './ui/button';
import {SidebarHint} from './sidebar-hint';
import { Input } from './ui/input';
import { Badge } from './ui';
import { SelectField } from './select-field';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';

type Source = 'preset' | 'upload';
type Clip = { blob: Blob; duration: number; name: string; id?: string };
type CallPhase = 'idle' | 'connecting' | 'live' | 'ended';
const recordings = [
  { id: 'CALL-1030', name: '账户业务咨询 · CALL-1030', src: '/audio/call-1030-dialogue.wav' },
  { id: 'CALL-1040', name: '身份核验查询 · CALL-1040', src: '/audio/review-dialogue-fa2d9871c1096b36.wav' },
  { id: 'CALL-1039', name: '业务办理进度 · CALL-1039', src: '/audio/review-dialogue-0620a0ec5ad851d4.wav' },
  { id: 'CALL-1035', name: '验证码安全提醒 · CALL-1035', src: '/audio/review-dialogue-8ee8289bba494381.wav' },
];
const timeLabel = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

export default function CallDemo() {
  const [view, setView] = useState<'closed' | 'expanded' | 'minimized'>('closed');
  const [source, setSource] = useState<Source>('preset');
  const [clips, setClips] = useState<Partial<Record<Source, Clip>>>({});
  const [loading, setLoading] = useState<Source | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [seconds, setSeconds] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const restore = useRef<HTMLButtonElement>(null);
  const minimize = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<HTMLButtonElement>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const request = useRef(0);
  const fetchController = useRef<AbortController | null>(null);
  const clip = clips[source];
  const active = phase === 'live' || phase === 'connecting';
  const busy = active || loading !== null;

  function releaseAudio() {
    if (player.current) {
      player.current.pause();
      player.current.onended = null;
      player.current.onerror = null;
      player.current.ontimeupdate = null;
      player.current.removeAttribute('src');
      player.current.load();
      player.current = null;
    }
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
  }

  useEffect(() => () => {
    request.current += 1;
    fetchController.current?.abort();
    releaseAudio();
  }, []);

  function closePanel() {
    request.current += 1;
    fetchController.current?.abort();
    releaseAudio();
    setLoading(null);
    setPhase('idle');
    setSeconds(0);
    setDragging(false);
    setError('');
    setView('closed');
    trigger.current?.focus({ preventScroll: true });
  }

  function minimizePanel() {
    setView('minimized');
    requestAnimationFrame(() => restore.current?.focus({ preventScroll: true }));
  }

  function restorePanel() {
    setView('expanded');
    requestAnimationFrame(() => minimize.current?.focus({ preventScroll: true }));
  }

  async function prepareAudio(target: Source, name: string, read: () => Promise<Blob>, id?: string) {
    if (busy) return;
    const generation = ++request.current;
    setLoading(target);
    setError('');
    setPhase('idle');
    setSeconds(0);
    let decoder: AudioContext | undefined;
    try {
      const blob = await read();
      if (generation !== request.current) return;
      if (!blob.size || blob.size > 50 * 1024 * 1024) throw new Error('请选择非空音频文件，大小不超过 50 MB。');
      if (!blob.type.startsWith('audio/') && !/\.(wav|mp3|m4a|ogg|webm|flac|aac)$/i.test(name) && target === 'upload') throw new Error('请选择 WAV、MP3、M4A 等音频文件。');
      decoder = new AudioContext();
      const decoded = await decoder.decodeAudioData(await blob.arrayBuffer());
      if (generation !== request.current) return;
      if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) throw new Error('音频时长无效，请重新选择。');
      setClips(previous => ({ ...previous, [target]: { blob, name, duration: decoded.duration, id } }));
    } catch (reason) {
      if (generation === request.current) setError(reason instanceof Error && reason.message.startsWith('请') ? reason.message : '无法读取音频，请重新选择或上传有效的 WAV / MP3 文件。');
    } finally {
      await decoder?.close().catch(() => {});
      if (generation === request.current) setLoading(null);
    }
  }

  function selectRecording(id: string) {
    const recording = recordings.find(item => item.id === id);
    if (!recording) return;
    fetchController.current?.abort();
    const controller = new AbortController();
    fetchController.current = controller;
    void prepareAudio('preset', recording.name, async () => {
      const response = await fetch(recording.src, { signal: controller.signal });
      if (!response.ok) throw new Error('音频加载失败');
      return response.blob();
    }, id);
  }

  function loadFile(file?: File) {
    if (file) void prepareAudio('upload', file.name, async () => file);
  }

  async function startCall() {
    if (!clip || busy) return;
    releaseAudio();
    const generation = ++request.current;
    const audio = new Audio(URL.createObjectURL(clip.blob));
    player.current = audio;
    audioUrl.current = audio.src;
    setError('');
    setSeconds(0);
    setPhase('connecting');
    audio.ontimeupdate = () => { if (generation === request.current) setSeconds(audio.currentTime); };
    audio.onended = () => {
      if (generation !== request.current) return;
      setSeconds(clip.duration);
      setPhase('ended');
      releaseAudio();
    };
    const fail = () => {
      if (generation !== request.current) return;
      releaseAudio();
      setPhase('idle');
      setError('音频播放失败，请重新接入或更换音频。');
    };
    audio.onerror = fail;
    try {
      await audio.play();
      if (generation === request.current && player.current === audio) {
        setPhase('live');
        minimizePanel();
      }
    } catch { fail(); }
  }

  function endCall() {
    request.current += 1;
    setSeconds(player.current?.currentTime ?? seconds);
    releaseAudio();
    setPhase('ended');
  }

  const status = loading ? '正在读取音频' : phase === 'live' ? '通话中' : phase === 'connecting' ? '正在接入' : phase === 'ended' ? '通话已结束' : clip ? '音频已就绪' : '等待选择音频';
  const open = view !== 'closed';
  return <>
    <SidebarHint label="模拟电话接入" enabled side="bottom"><Button type="button" variant="ghost" ref={trigger} className={`${styles.trigger} ${open ? styles.selected : ''}`} aria-label="模拟电话接入" aria-expanded={view === 'expanded'} aria-controls="call-demo-panel" onClick={() => setView('expanded')}>
      <PhoneCall size={18} aria-hidden="true"/>{active && <i className={styles.liveDot}/>}
    </Button></SidebarHint>
    {typeof document !== 'undefined' && createPortal(<>
      <section id="call-demo-panel" className={styles.panel} data-visible={view === 'expanded'} inert={view !== 'expanded'} aria-hidden={view !== 'expanded'} aria-label="模拟电话接入" onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); minimizePanel(); } }}>
        <header className={styles.header}>
          <div className={styles.heading}><h2>模拟电话接入</h2><p>选择或上传通话录音</p></div>
          <div className={styles.headerActions}>
            <Button ref={minimize} variant="ghost" size="icon-sm" className={styles.iconButton} aria-label="最小化电话接入" onClick={minimizePanel}><Minus size={18} aria-hidden="true"/></Button>
            <Button variant="ghost" size="icon-sm" className={styles.iconButton} aria-label="关闭电话接入" onClick={closePanel}><X size={18} aria-hidden="true"/></Button>
          </div>
        </header>
        <div className={styles.body}>
          <Tabs value={source} onValueChange={value => { if (!busy) { setSource(value as Source); setError(''); setDragging(false); setPhase('idle'); setSeconds(0); } }}>
            <TabsList variant="line" className={`ui-tabs ${styles.tabs}`} aria-label="音频来源" data-source={source}>
              <span className={styles.tabIndicator} aria-hidden="true"/>
              <TabsTrigger value="preset" disabled={busy}><AudioLines size={16} aria-hidden="true"/>选择音频</TabsTrigger>
              <TabsTrigger value="upload" disabled={busy}><Upload size={16} aria-hidden="true"/>上传音频</TabsTrigger>
            </TabsList>
            <TabsContent value={source} className={styles.sourceContent}>
              <div className={styles.status}><span role="status"><Badge tone={phase === 'live' ? 'success' : 'neutral'}>{status}</Badge></span><time>{timeLabel(phase === 'idle' ? clip?.duration ?? 0 : seconds)}</time></div>
              <div className={styles.sourcePicker}>
                {source === 'preset' ? <><label htmlFor="call-audio-selection">通话音频</label><SelectField id="call-audio-selection" name="call-audio-selection" aria-label="选择通话音频" value={clip?.id ?? ''} onValueChange={selectRecording} disabled={busy} required className={styles.audioSelect}><option value="" disabled>请选择通话音频</option>{recordings.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField></> : <>
                  <Input ref={input} type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac,.aac" className="sr-only" tabIndex={-1} aria-label="上传通话音频文件" onChange={event => { loadFile(event.target.files?.[0]); event.target.value = ''; }}/>
                  {clip ? <div className={styles.uploadedFile}><AudioLines size={18} aria-hidden="true"/><span className={styles.fileName} title={clip.name}>{clip.name}</span><Button variant="ghost" size="icon-sm" disabled={busy} aria-label="移除已选音频" className={styles.iconButton} onClick={() => { setClips(previous => ({ ...previous, upload: undefined })); setError(''); setPhase('idle'); setSeconds(0); requestAnimationFrame(() => uploadTarget.current?.focus()); }}><X size={16} aria-hidden="true"/></Button></div> : <Button type="button" variant="ghost" ref={uploadTarget} className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`} disabled={busy} onClick={() => input.current?.click()} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); loadFile(event.dataTransfer.files[0]); }}><b>{loading ? '正在读取音频…' : '选择或拖入通话录音'}</b><small>WAV、MP3、M4A 等 · 最大 50 MB</small></Button>}
                </>}
              </div>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <Button className={`btn ${active ? styles.hangup : 'primary'} ${styles.primary}`} variant={active ? 'destructive' : 'default'} disabled={!!loading || !clip} onClick={active ? endCall : () => void startCall()}>{active ? <PhoneOff size={18} aria-hidden="true"/> : <PhoneCall size={18} aria-hidden="true"/>}{active ? '结束通话' : '接入电话'}</Button>
            </TabsContent>
          </Tabs>
        </div>
      </section>
      <section className={styles.minimized} data-visible={view === 'minimized'} inert={view !== 'minimized'} aria-hidden={view !== 'minimized'} aria-label="已最小化的电话接入">
        <div className={styles.callSummary}><PhoneCall size={18} aria-hidden="true"/><b role="status">{status}</b><time>{timeLabel(seconds)}</time></div>
        <div className={styles.minimizedActions}>
          <Button ref={restore} variant="ghost" size="icon-sm" className={styles.iconButton} aria-label="恢复电话接入面板" onClick={restorePanel}><Maximize2 size={16} aria-hidden="true"/></Button>
          <Button variant="ghost" size="icon-sm" className={`${styles.iconButton} ${styles.endCall}`} aria-label="挂断电话" disabled={!active} onClick={closePanel}><PhoneOff size={18} aria-hidden="true"/></Button>
        </div>
      </section>
    </>, document.body)}
  </>;
}
