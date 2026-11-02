"use client";
import { SurfaceButton } from "./ui/button";
import { useEffect, useRef, useState } from 'react';
import type { Metric } from '../lib/reports';
import type { TrendPoint, VisualGroup } from '../lib/report-visuals';

export const chartColors = { orange: 'var(--orange)', green: 'var(--green)', red: 'var(--red)', slate: 'var(--chart-slate)', gray: 'var(--chart-gray)', light: 'var(--line)' };
export const formatNumber = (n: number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(n);
export function TrendChart({ points, stride, metric, onInspect }: { points: TrendPoint[]; stride: number; metric: Metric; onInspect: (p: TrendPoint) => void }) {
  const [cursor, setCursor] = useState<number>();
  const [pointerY,setPointerY]=useState<number>();
  const canvasRef=useRef<HTMLDivElement>(null);
  const calloutRef=useRef<HTMLDivElement>(null);
  const [geometry,setGeometry]=useState({width:720,calloutHeight:112});
  useEffect(()=>{
    const canvas=canvasRef.current,callout=calloutRef.current;
    if(!canvas) return;
    const observer=new ResizeObserver(()=>{
      const width=canvas.clientWidth,calloutHeight=callout?.offsetHeight ?? 112;
      if(width>0) setGeometry(previous=>previous.width===width && previous.calloutHeight===calloutHeight ? previous : {width,calloutHeight});
    });
    observer.observe(canvas);
    if(callout) observer.observe(callout);
    return ()=>observer.disconnect();
  },[]);
  const frame=useRef<number | null>(null);
  const pending=useRef<{index:number;y:number} | null>(null);
  useEffect(()=>()=>{if(frame.current!==null) cancelAnimationFrame(frame.current);},[]);
  const selectWithKeyboard=(index:number)=>{
    if(frame.current!==null) cancelAnimationFrame(frame.current);
    frame.current=null;
    setPointerY(undefined);
    setCursor(index);
  };
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const last = points.findLastIndex(p => p.value !== null), active = Math.min(cursor ?? Math.max(0, last), points.length - 1), point = points[active];
  const ratio = metric.key === 'coverage' || metric.key === 'fp', unit = ratio ? '%' : metric.key === 'calls' ? '通' : '项';
  const width = geometry.width, height = Math.max(240,Math.min(340,width * 320 / 720)), left = 48, right = 32, top = 30, bottom = 38;
  const maxValue = Math.max(1, ...points.map(p => p.value ?? 0));
  const ceiling = ratio ? 100 : Math.max(4, Math.ceil(maxValue / 4) * 4);
  const x = (i: number) => left + i / Math.max(1, points.length - 1) * (width - left - right);
  const y = (value: number) => top + (1 - value / ceiling) * (height - top - bottom);
  const segments: { x: number; y: number }[][] = [];
  points.forEach((p, i) => { if (p.value === null) return; if (i === 0 || points[i - 1].value === null) segments.push([]); segments.at(-1)!.push({ x: x(i), y: y(p.value) }); });
  const valueText = (p: TrendPoint) => p.value === null ? '无可比样本' : `${formatNumber(p.value)} ${unit}`;
  return <section className="qa-trend" aria-label={`${metric.label}趋势`}>
    <div className="qa-chart-heading"><div><h2>{stride === 1 ? '每日' : '分段'}{metric.label}</h2><p><span className="qa-dot" style={{ background: chartColors.orange }}/>{unit === '%' ? stride === 1 ? '按日内样本计算占比' : '按段内样本计算占比' : `按通话结束日期 · ${unit}`} {stride > 1 && `· 每段 ${stride} 天`}</p></div><span className="qa-window">{points[0]?.label} — {points.at(-1)?.end.slice(5).replace('-', '/')}</span></div>
    <div ref={canvasRef} className="qa-trend-canvas" style={{height}} onPointerMove={event => {
      const bounds=event.currentTarget.getBoundingClientRect();
      const plotX=(event.clientX-bounds.left)/bounds.width*width;
      pending.current={index:Math.max(0,Math.min(points.length-1,Math.round((plotX-left)/(width-left-right)*(points.length-1)))),y:(event.clientY-bounds.top)/bounds.height*100};
      if(frame.current===null) frame.current=requestAnimationFrame(()=>{
        frame.current=null;
        if(pending.current){setCursor(pending.current.index);setPointerY(pending.current.y);}
      });
    }}>
      <svg key={metric.key} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1={left} y1={y(i * ceiling / 4)} x2={width - right} y2={y(i * ceiling / 4)} className="qa-gridline"/><text x={left - 10} y={y(i * ceiling / 4) + 5} textAnchor="end">{formatNumber(i * ceiling / 4)}</text></g>)}
        {segments.map((segment, i) => { const path = segment.map((p, n) => `${n ? 'L' : 'M'}${p.x},${p.y}`).join(' ');return <g key={i}><path d={`${path} L${segment.at(-1)!.x},${y(0)} L${segment[0].x},${y(0)} Z`} className="qa-trend-area" fill="#fff0e5" opacity=".6"/><path className="qa-trend-line" pathLength="1" d={path} fill="none" stroke={chartColors.orange} strokeWidth="2.5" strokeLinejoin="round"/>{segment.map((p, j) => <circle key={j} cx={p.x} cy={p.y} r="3" fill="white" stroke={chartColors.orange} strokeWidth="2"/>)}</g>;})}
        {point?.value !== null && point && <g><g className="qa-chart-cursor" style={{transform:`translateX(${x(active)}px)`}}><line x1="0" x2="0" y1={top} y2={height-bottom} stroke="var(--line)"/></g><circle className="qa-chart-active-dot" cx="0" cy="0" r="5" style={{transform:`translate(${x(active)}px, ${y(point.value)}px)`}} fill={chartColors.orange} stroke="var(--surface)" strokeWidth="2"/></g>}
        {points.map((p,i)=>i===0 || i===points.length-1 || i%Math.max(1,Math.ceil(points.length/(width<500 ? 4 : 8)))===0 ? <text key={p.start} x={x(i)} y={height-10} textAnchor={i===0 ? "start" : i===points.length-1 ? "end" : "middle"}>{p.label}</text> : null)}
      </svg>
      {points.map((p, i) => <SurfaceButton key={p.start} ref={el => { buttons.current[i] = el; }} className={`qa-point ${active === i ? 'selected' : ''}`} style={{ left: `${x(i) / width * 100}%`, top: `${y(p.value ?? 0) / height * 100}%` }} tabIndex={active === i ? 0 : -1} aria-label={`${p.start}${stride > 1 ? `至${p.end}` : ''}，${valueText(p)}，查看明细`} onFocus={() => selectWithKeyboard(i)} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1))); buttons.current[next]?.focus(); } }} onClick={() => onInspect(p)}><span className={p.value === null ? 'missing' : ''}/></SurfaceButton>)}
      {point && <div className="qa-callout-anchor" style={{width:Math.min(240,width-16),transform:`translate3d(${Math.max(8,Math.min(width-Math.min(240,width-16)-8,x(active)+16))}px, ${Math.max(8,Math.min(height-geometry.calloutHeight-8,(pointerY!==undefined ? pointerY/100*height : y(point.value??0))-geometry.calloutHeight-16))}px, 0)`}}><div ref={calloutRef} className="qa-chart-callout qa-trend-float">
        <div>{point.start}{stride>1 ? ` — ${point.end}` : ' · 全天'}</div>
        <p style={{color:chartColors.orange}}>{metric.label}：{valueText(point)}</p>
        {ratio && point.denominator!==undefined && <small>样本 {point.count} / {point.denominator}</small>}
      </div></div>}

    </div>
    <div className="qa-chart-readout" aria-live="polite"><span>{point?.start}{stride > 1 && ` — ${point?.end}`}{ratio && point?.denominator !== undefined && <small>样本 {point.count} / {point.denominator}</small>}</span><strong>{point ? valueText(point) : '暂无数据'}</strong><SurfaceButton type="button" className="text-button" onClick={() => point && onInspect(point)}>查看该{stride > 1 ? '段' : '日'}明细</SurfaceButton></div>
    <p className="qa-chart-hint sr-only">方向键切换日期，Enter 查看明细。{ratio ? '无分母日期留空，不连接为 0%。' : '数量按当前筛选范围汇总。'}</p>
  </section>;
}

type RingGroup = {key:string;label:string;count:number;color:string};
export function RingChart({ title, note, groups, center, centerLabel, onSelect }: { title: string; note: string; groups: RingGroup[]; center?: string; centerLabel?: string; onSelect: (key: string) => void }) {
  const [highlight,setHighlight]=useState<string>();
  const total=groups.reduce((n,g)=>n+g.count,0);
  const selected=groups.find(g=>g.key===highlight) ?? groups.find(g=>g.count>0) ?? groups[0];
  const percent=(count:number)=>total ? `${(count/total*100).toFixed(1)}%` : "—";
  let offset=0;
  return <section className="qa-ring-section"><div className="qa-chart-heading"><div><h2>{title}</h2><p>{note}</p></div></div>
    <div className="qa-ring-stage">
      <svg viewBox="0 0 360 260" role="img" aria-label={groups.map(g=>`${g.label} ${g.count}，占比 ${percent(g.count)}`).join('；')}>
        <circle cx="150" cy="155" r="70" fill="none" stroke="var(--line)" strokeWidth="18"/>
        {total>0 && groups.map(g=>{const start=offset;offset+=g.count/total*100;return g.count>0 && <circle className="qa-ring-segment" key={g.key} cx="150" cy="155" r="70" fill="none" stroke={g.color} strokeWidth={selected?.key===g.key ? 23 : 18} pathLength="100" strokeDasharray={`${g.count/total*100} ${100-g.count/total*100}`} strokeDashoffset={-start} transform="rotate(-90 150 155)" onPointerEnter={()=>setHighlight(g.key)}/>;})}
        <text x="150" y="153" className="qa-ring-total" textAnchor="middle">{center ?? formatNumber(total)}</text>
        <text x="150" y="174" className="qa-ring-center-label" textAnchor="middle">{centerLabel ?? '问题合计'}</text>
      </svg>
      <div className="qa-chart-callout qa-ring-float" aria-live="polite">
        <div className="qa-callout-content" key={selected?.key}><div>{selected?.label ?? title}</div>
        <p><i className="qa-dot" style={{background:selected?.color}}/>数量：{formatNumber(selected?.count??0)}<span>占比：{percent(selected?.count??0)}</span></p>
        {!total && <small>暂无样本，占比不计算</small>}</div>
      </div>
    </div>
    <div className="qa-legend">{groups.map(g=><SurfaceButton key={g.key} className={selected?.key===g.key ? 'is-highlighted' : ''} onPointerEnter={()=>setHighlight(g.key)} onFocus={()=>setHighlight(g.key)} onClick={()=>onSelect(g.key)} aria-label={`${g.label} ${g.count}，占比 ${percent(g.count)}，查看明细`}><span className="qa-dot" style={{background:g.color}}/><span>{g.label}</span><b>{formatNumber(g.count)}</b><small>{percent(g.count)}</small></SurfaceButton>)}</div>
  </section>;
}

export function HorizontalBars({ groups, total, onSelect, unit = '项', color = chartColors.orange, denominators }: { groups: VisualGroup[]; total: number; onSelect: (key: string) => void; unit?: string; color?: string; denominators?: Record<string, number> }) {
  const max = Math.max(1, ...groups.map(g => g.rows.length));
  return <div className={`qa-bars${denominators ? ' qa-ratio-bars' : ''}`}>{groups.map(g => {
    const count=g.rows.length, denominator=denominators?.[g.key] ?? 0;
    const percent=denominator ? `${(count/denominator*100).toFixed(1)}%` : '—';
    return <SurfaceButton key={g.key} className="qa-bar-row" onClick={() => onSelect(g.key)} aria-label={denominators ? `${g.label}，${percent}，确认风险 ${count} / 自动检测完成 ${denominator} 通，查看明细` : `${g.label}，${count}${unit}，查看明细`}><span className="qa-bar-label">{g.label}</span><span className="qa-bar-track"><i style={{ width: `${denominators ? denominator ? count/denominator*100 : 0 : count/max*100}%`, background: color }}/></span><b>{denominators ? percent : <>{count}<small>{unit}</small></>}</b><span className="qa-share">{denominators ? `${count}/${denominator}` : total ? `${(count/total*100).toFixed(0)}%` : '—'}</span><span className="qa-bar-callout">{g.label} · {denominators ? `确认风险 ${count} / 自动检测完成 ${denominator} 通` : `${count} / ${total} ${unit}`} · 点击查看明细</span></SurfaceButton>;
  })}</div>;
}
