"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { groupSopRows, type SopMatrixRow } from "../lib/sop-matrix";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";

export function SopMatrixTable({ groups, rows, onChange }: { groups: SopMatrixRow[]; rows?: string[][]; onChange?: (rows: string[][]) => void }) {
  const editing = !!onChange && !!rows;
  const columns = Array.from({ length: Math.max(1, ...groups.map(group => group.steps.length)) }, (_, index) => index);
  const updateStep = (index: number, col: number, value: string) => onChange?.(rows!.map((row, i) => i === index ? row.map((cell, j) => j === col ? value : cell) : row));
  const removeStep = (group: SopMatrixRow, index: number) => {
    const remaining = group.steps.filter(step => step.index !== index);
    const numbers = new Map(remaining.map((step, i) => [step.index, String(i + 1)]));
    onChange?.(rows!.flatMap((row, i) => i === index ? [] : [numbers.has(i) ? [row[0], numbers.get(i)!, row[2], row[3]] : row]));
  };
  return <table style={{ minWidth: 232 + columns.length * 256 }} className={`resource-record-table sop-matrix-table${editing ? " resource-edit-table" : ""}`}>
    <colgroup><col style={{ width: 40 }}/><col style={{ width: 192 }}/>{columns.map(index => <col key={index}/>)}</colgroup>
    <thead><tr><th scope="col" className="resource-row-number">行号</th><th scope="col" className="sop-matrix-name">SOP 名称</th>{columns.map(index => <th scope="col" key={index}>步骤 {index + 1}</th>)}</tr></thead>
    <tbody>{groups.map((group, groupIndex) => <tr key={groupIndex}>
      <td className="resource-row-number">{groupIndex + 1}</td>
      <th scope="row" className="sop-matrix-name"><div className="sop-matrix-identity">{editing ? <Input id={`resource-sop-${group.steps[0].index}-0`} name={`sop-name-${groupIndex}`} autoComplete="off" aria-label={`第 ${groupIndex + 1} 行 SOP 名称`} required value={group.name} onChange={event => {
        const indices = new Set(group.steps.map(step => step.index));
        onChange(rows!.map((row, index) => indices.has(index) ? [event.target.value, ...row.slice(1)] : row));
      }}/> : <span className="sop-matrix-title">{group.name || "未命名 SOP"}</span>}<span className="sop-matrix-meta">{group.steps.length} 个步骤 · {group.steps.filter(step=>step.required==="是").length} 个必需</span>{editing && <div className="sop-matrix-actions"><Button type="button" variant="ghost" size="sm" className="sop-add-step" aria-label={`为${group.name || `第 ${groupIndex + 1} 行 SOP`}添加步骤`} onClick={() => {
        const last = group.steps.at(-1)!.index, next = [...rows!];
        next.splice(last + 1, 0, [group.name, String(group.steps.length + 1), "", "是"]);
        onChange(next);
        requestAnimationFrame(() => document.getElementById(`resource-sop-${last + 1}-2`)?.focus());
      }}><Plus size={14} aria-hidden="true"/>添加步骤</Button><Button type="button" variant="ghost" size="icon-xs" className="sop-delete-rule" title="删除 SOP" aria-label={`删除${group.name || `第 ${groupIndex + 1} 行 SOP`}`} onClick={() => {
        const indices = new Set(group.steps.map(step => step.index));
        onChange(rows!.filter((_, index) => !indices.has(index)));
      }}><Trash2 size={14} aria-hidden="true"/></Button></div>}</div></th>
      {columns.map(column => {
        const step = group.steps[column], label = `${group.name || `第 ${groupIndex + 1} 行 SOP`} 步骤 ${column + 1}`;
        return <td key={column}>{step ? editing ? <div className="sop-matrix-step">
          <Textarea id={`resource-sop-${step.index}-2`} name={`sop-step-${step.index}`} autoComplete="off" aria-label={`${label} 内容`} required rows={2} value={step.content} onChange={event => updateStep(step.index, 2, event.target.value)}/>
          <div className="sop-matrix-step-options"><label><Switch aria-label={`${label} 是否必需`} checked={step.required === "是"} onCheckedChange={checked => updateStep(step.index, 3, checked ? "是" : "否")}/><span>{step.required === "是" ? "必需" : "可选"}</span></label><Button type="button" variant="ghost" size="icon-xs" className="sop-delete-step" title={group.steps.length===1?"至少保留一个步骤":`删除${label}`} disabled={group.steps.length === 1} aria-label={`删除${label}`} onClick={() => removeStep(group, step.index)}><Trash2 size={14} aria-hidden="true"/></Button></div>
        </div> : <div className="sop-matrix-step"><p>{step.content || "—"}</p><span className={`sop-matrix-required${step.required==="否"?" is-optional":""}`}>{step.required==="是"?"必需":step.required==="否"?"可选":"未设置"}</span></div> : <span className="sop-matrix-empty" aria-label="无此步骤">—</span>}</td>;
      })}

    </tr>)}</tbody>
  </table>;
}

export function SopMatrixPreview({ rows, search = "", limit }: { rows: string[][]; search?: string; limit?: number }) {
  const query = search.trim().toLowerCase();
  const groups = groupSopRows(rows).filter(group => [group.name, ...group.steps.flatMap(step => [step.content, step.required])].join(" ").toLowerCase().includes(query));
  return groups.length ? <SopMatrixTable groups={groups.slice(0, limit ?? groups.length)}/> : <p className="hotword-preview-empty">{query ? "未找到匹配 SOP" : "暂无 SOP 规则"}</p>;
}


export function SopMatrixScroll({ children, editing = false, resetKey = "" }: { children: ReactNode; editing?: boolean; resetKey?: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ overflow: false, start: true, end: true });
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => {
      const next = { overflow: element.scrollWidth > element.clientWidth + 2, start: element.scrollLeft <= 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 };
      setScroll(previous => previous.overflow === next.overflow && previous.start === next.start && previous.end === next.end ? previous : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const table = element.querySelector("table");
    if (table) observer.observe(table);
    element.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => { observer.disconnect(); element.removeEventListener("scroll", measure); };
  }, [children]);
  useEffect(() => { viewport.current?.scrollTo({ top: 0, left: 0 }); }, [resetKey]);
  return <div className="sop-matrix-viewport">
    <div ref={viewport} className="resource-record-scroll sop-matrix-scroll" role="region" tabIndex={0} aria-label={editing ? "SOP 步骤编辑矩阵" : "SOP 步骤矩阵"}>{children}</div>
    {scroll.overflow && <div className="sop-scroll-controls"><span>左右浏览更多步骤</span><div><Button type="button" variant="outline" size="icon-sm" disabled={scroll.start} aria-label="查看前面的步骤" onClick={() => viewport.current?.scrollBy({ left: -256 })}><ChevronLeft size={16} aria-hidden="true"/></Button><Button type="button" variant="outline" size="icon-sm" disabled={scroll.end} aria-label="查看后面的步骤" onClick={() => viewport.current?.scrollBy({ left: 256 })}><ChevronRight size={16} aria-hidden="true"/></Button></div></div>}
  </div>;
}
