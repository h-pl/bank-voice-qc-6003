"use client";
import type { ReactNode } from "react";
import { RecordRow } from "./record-id";
export function QueueCard({ selected, onOpen, label, children }: {
  selected: boolean; onOpen: () => void; label: string; children: ReactNode;
}) {
  return <RecordRow className={`queue-card ${selected ? "selected" : ""}`} selected={selected} label={label} onOpen={onOpen}>{children}</RecordRow>;
}
