"use client";
import { useState } from "react";
import { SurfaceButton } from "./ui/button";
import { Badge } from "./ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { indicatorName } from "../lib/strategy-schema";
import type { Finding, State } from "../lib/workflow";

const VISIBLE_INDICATORS = 5;

type Group = { id: string; findings: Finding[] };
export function Review2Indicators({ state, findingIds, onRule }: { state: State; findingIds: string[]; onRule: (id: string, matchingIds: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const groups: Group[] = [];
  for (const id of findingIds) {
    const finding = state.findings.find(item => item.id === id);
    if (!finding) continue;
    const group = groups.find(item => item.id === finding.indicator);
    if (group) group.findings.push(finding);
    else groups.push({ id: finding.indicator, findings: [finding] });
  }
  const chip = (group: Group) => <Badge key={group.id} asChild variant="secondary" className="review2-indicator-chip"><SurfaceButton type="button" aria-label={`查看${indicatorName(group.id)}的命中规则`} onClick={() => { setOpen(false); onRule(group.findings[0].id, group.findings.map(finding => finding.id)); }}>{indicatorName(group.id)}</SurfaceButton></Badge>;
  return <div className="review2-header-indicators"><span>触发指标</span><div className="review2-indicator-list">
    {groups.slice(0, VISIBLE_INDICATORS).map(chip)}
    {!groups.length && <span>未记录</span>}
    {groups.length > VISIBLE_INDICATORS && <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Badge asChild variant="secondary" className="review2-indicator-chip"><SurfaceButton type="button" aria-label={`查看其余 ${groups.length - VISIBLE_INDICATORS} 个触发指标`}>+{groups.length - VISIBLE_INDICATORS}</SurfaceButton></Badge></PopoverTrigger><PopoverContent align="start" className="review2-indicator-popover" aria-label="其余触发指标"><h3>其余触发指标</h3><div className="review2-indicator-list">{groups.slice(VISIBLE_INDICATORS).map(chip)}</div></PopoverContent></Popover>}
  </div></div>;
}
