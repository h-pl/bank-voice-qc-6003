"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { zhCN } from "react-day-picker/locale";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { parseCalendarDate, calendarDateValue } from "../../lib/date-picker-value";

export function DateRangePicker({ start, end, onValueChange }: {
  start: string; end: string; onValueChange: (start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>();
  const [choosingEnd, setChoosingEnd] = useState(false);
  const [month, setMonth] = useState<Date>();
  const display = (value: string) => value.replaceAll("-", "/");
  const text = start || end ? `${start ? display(start) : "不限"} – ${end ? display(end) : "不限"}` : "日期范围";
  function changeOpen(next: boolean) {
    if (next) {
      const from = parseCalendarDate(start), to = parseCalendarDate(end);
      setDraft(from || to ? { from, to } : undefined);
      setMonth(from ?? to ?? new Date());
      setChoosingEnd(false);
    }
    setOpen(next);
  }
  return <span className="date-picker-field date-range-field">
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild><Button type="button" variant="outline" className="date-picker-trigger" data-control-surface="true" aria-label={`通话日期范围：${text}`}><span className={!start && !end ? "date-picker-placeholder" : undefined}>{text}</span><CalendarIcon aria-hidden="true"/></Button></PopoverTrigger>
      <PopoverContent align="start" collisionPadding={12} className="date-picker-popover date-range-popover" aria-label="通话日期范围选择器">
        <p className="date-range-hint" role="status">{choosingEnd ? "请选择结束日期" : draft?.to ? "已选择日期范围" : "请选择开始日期"}</p>
        <Calendar mode="range" locale={zhCN} selected={draft} month={month} onMonthChange={setMonth} autoFocus onSelect={(_range, day) => {
          if (!choosingEnd || !draft?.from) { setDraft({ from: day }); setChoosingEnd(true); }
          else { setDraft(day < draft.from ? { from: day, to: draft.from } : { from: draft.from, to: day }); setChoosingEnd(false); }
        }} labels={{ labelNext: () => "下个月", labelPrevious: () => "上个月" }}/>
        <p className="date-range-summary">{draft?.from ? display(calendarDateValue(draft.from)) : "开始日期"} – {draft?.to ? display(calendarDateValue(draft.to)) : "结束日期"}</p>
        <div className="date-picker-actions">
          <Button type="button" variant="ghost" size="sm" disabled={!start && !end && !draft} onClick={() => { onValueChange("", ""); setOpen(false); }}>清除</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>取消</Button>
          <Button type="button" size="sm" disabled={!draft?.from || !draft?.to} onClick={() => { if (draft?.from && draft.to) { onValueChange(calendarDateValue(draft.from), calendarDateValue(draft.to)); setOpen(false); } }}>应用</Button>
        </div>
      </PopoverContent>
    </Popover>
  </span>;
}
