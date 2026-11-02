"use client";
import { businessRecordText } from "../lib/timeline-presentation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SurfaceButton, buttonVariants } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

export function CopyRecordId({ id }: { id: string }) {
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const [open, setOpen] = useState(false);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(timer.current); };
  }, []);
  async function copy() {
    if (busy.current) return;
    busy.current = true;
    clearTimeout(timer.current);
    setStatus("copying");
    try {
      await navigator.clipboard.writeText(id);
      if (mounted.current) { setStatus("copied"); setOpen(true); }
    } catch {
      if (mounted.current) { setStatus("failed"); setOpen(true); }
    } finally {
      busy.current = false;
      if (mounted.current) timer.current = setTimeout(() => { setOpen(false); setStatus("idle"); }, 2500);
    }
  }
  const feedback = status === "copied" ? "已复制" : status === "failed" ? "复制失败，请重试" : "";
  return <span className="record-id-copy-wrap">
    <TooltipProvider><Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild><SurfaceButton type="button" className="record-id-copy" aria-label={`复制编号 ${id}`} aria-busy={status === "copying"} onClick={event => { event.preventDefault(); event.stopPropagation(); void copy(); }}>{id}</SurfaceButton></TooltipTrigger>
      <TooltipContent side="top" align="start" sideOffset={6} collisionPadding={12} className="record-id-tooltip" onEscapeKeyDown={event=>event.stopPropagation()}>{feedback || <><span className="record-id-tooltip-value">{id}</span><span>点击复制编号</span></>}</TooltipContent>
    </Tooltip></TooltipProvider>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{feedback}</span>
  </span>;
}

export function RecordReference({ id, onOpen, label = "查看" }: { id: string; onOpen: () => void; label?: string }) {
  return <span className="record-reference"><CopyRecordId id={id}/><SurfaceButton type="button" className="record-reference-open" data-record-open={id} aria-label={`${label} ${id}`} onClick={onOpen}>{label}</SurfaceButton></span>;
}

// Source calls are navigation entries; copying remains available in the detail sheet.
export function CallReference({ id, onOpen }: { id: string; onOpen: () => void }) {
  return <TooltipProvider><Tooltip><TooltipTrigger asChild><SurfaceButton type="button" className="source-call-link" data-record-open={id} aria-label={`打开通话详情 ${id}`} onClick={onOpen}>{id}</SurfaceButton></TooltipTrigger><TooltipContent side="top" align="start" className="record-id-tooltip">{id}</TooltipContent></Tooltip></TooltipProvider>;
}

// Keeps the row action and each copy action as sibling native buttons.
export function RecordRow({ children, onOpen, label, className = "", selected, tooltip }: { children: ReactNode; onOpen: () => void; label: string; className?: string; selected?: boolean; tooltip?: string }) {
  const trigger = <SurfaceButton type="button" className="record-row-open" aria-label={label} aria-pressed={selected} onClick={onOpen}/>;
  return <div data-slot="button" className={`${buttonVariants({ variant: "ghost" })} record-row ${className}`}>
    {tooltip ? <TooltipProvider delayDuration={300}><Tooltip><TooltipTrigger asChild>{trigger}</TooltipTrigger><TooltipContent side="top" align="start" sideOffset={8} collisionPadding={12} className="record-id-tooltip" onEscapeKeyDown={event=>event.stopPropagation()}>{tooltip}</TooltipContent></Tooltip></TooltipProvider> : trigger}{children}
  </div>;
}

// Only explicit business ID prefixes are recognized; dates, row numbers and versions stay text.
export function RecordText({ text }: { text: string }) {
  const parts = businessRecordText(text).split(/(\b(?:CALL|F|WO|AP|REC|RM|REM|REMEDY|SAMPLE|SB|SP|SUP|R|RES|POL|ALERT|BATCH|B|DET|DR|WD|EV|LOG)-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*|\b[SQM]\d{2,}\b)/g);
  return <>{parts.map((part, index) => index % 2 ? <CopyRecordId key={index} id={part}/> : part)}</>;
}
