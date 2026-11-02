"use client";
import { type RefObject } from "react";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function EvidenceNavigation({ transcriptRef, segments, current, onLocate }: {
  transcriptRef: RefObject<HTMLDivElement | null>;
  segments: number[];
  current?: number;
  onLocate: (index: number) => void;
}) {
  const currentIndex = Math.max(0, segments.indexOf(current ?? -1));
  const locate = (direction: -1 | 0 | 1) => {
    if (!segments.length) return;
    const segment = segments[(currentIndex + direction + segments.length) % segments.length];
    onLocate(segment);
    const row = transcriptRef.current?.children[segment] as HTMLElement | undefined;
    row?.focus({ preventScroll: true });
  };
  if (segments.length < 2) return null;
  return <div className="evidence-locate-actions" role="group" aria-label="命中片段导航">
    <span aria-label={`命中第${currentIndex + 1}段，共${segments.length}段`}>{currentIndex + 1}/{segments.length}</span>
    <Button type="button" variant="ghost" size="icon" title="上一段证据" aria-label="上一段证据" onClick={() => locate(-1)}><ChevronLeft aria-hidden="true"/></Button>
    <Button type="button" variant="ghost" size="icon" title="下一段证据" aria-label="下一段证据" onClick={() => locate(1)}><ChevronRight aria-hidden="true"/></Button>
  </div>;
}
