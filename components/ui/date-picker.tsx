"use client";

import { useId, useRef, useState, type ComponentProps } from "react";
import { CalendarIcon } from "lucide-react";
import { zhCN } from "react-day-picker/locale";
import { Button } from "./button";
import { Input } from "./input";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { parseCalendarDate, calendarDateValue } from "../../lib/date-picker-value";
import { cn } from "@/lib/utils";

type Props = Pick<ComponentProps<"input">, "id" | "name" | "required" | "disabled" | "aria-label" | "aria-invalid" | "aria-describedby" | "className"> & {
  value: string;
  onValueChange: (value: string) => void;
  withTime?: boolean;
};

export function DatePicker({ value, onValueChange, withTime = false, required, disabled, className, name, id, ...aria }: Props) {
  const generatedId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parseCalendarDate(value);
  const [month, setMonth] = useState<Date | undefined>(selected);
  const time = value.includes('T') ? value.slice(11,16) : '09:00';
  const [hour, minute] = time.split(':');
  const label = aria['aria-label'] ?? (withTime ? '日期和时间' : '日期');
  const changeTime = (nextHour: string, nextMinute: string) => {
    const day = selected ?? new Date();
    onValueChange(`${calendarDateValue(day)}T${nextHour}:${nextMinute}`);
  };
  return <span className={cn('date-picker-field', className)}>
    <Popover open={open} onOpenChange={next => { if (next) setMonth(selected ?? new Date()); setOpen(next); }}>
      <PopoverTrigger asChild>
        <Button ref={trigger} id={id ?? generatedId} type="button" variant="outline" disabled={disabled} className="date-picker-trigger" data-control-surface="true" aria-required={required || undefined} {...aria}>
          <span className={!value ? 'date-picker-placeholder' : undefined}>{value ? value.replace('T',' ').replaceAll('-','/') : withTime ? '选择日期和时间' : '选择日期'}</span><CalendarIcon aria-hidden="true"/>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={12} className="date-picker-popover" aria-label={`${label}选择器`}>
        <Calendar mode="single" locale={zhCN} selected={selected} month={month} onMonthChange={setMonth} autoFocus onSelect={date => {
          if (!date) return;
          onValueChange(calendarDateValue(date) + (withTime ? `T${time}` : ''));
          if (!withTime) setOpen(false);
        }} labels={{labelNext:()=> '下个月',labelPrevious:()=> '上个月'}}/>
        {withTime && <div className="date-picker-time"><span>时间</span>
          <Select value={hour} onValueChange={next=>changeTime(next,minute)}><SelectTrigger aria-label="小时"><SelectValue/></SelectTrigger><SelectContent position="popper">{Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(item=><SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
          <span>:</span>
          <Select value={minute} onValueChange={next=>changeTime(hour,next)}><SelectTrigger aria-label="分钟"><SelectValue/></SelectTrigger><SelectContent position="popper">{Array.from({length:60},(_,i)=>String(i).padStart(2,'0')).map(item=><SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
        </div>}
        <div className="date-picker-actions">
          <Button type="button" variant="ghost" size="sm" disabled={!value} onClick={()=>{onValueChange('');setOpen(false);}}>清除</Button>
          <Button type="button" variant="ghost" size="sm" onClick={()=>{const today=new Date();setMonth(today);onValueChange(calendarDateValue(today)+(withTime?`T${time}`:''));if(!withTime)setOpen(false);}}>今天</Button>
          {withTime && <Button type="button" size="sm" onClick={()=>setOpen(false)}>完成</Button>}
        </div>
      </PopoverContent>
    </Popover>
    <Input className="date-picker-validation sr-only" data-control-surface={undefined} tabIndex={-1} aria-hidden="true" name={name} required={required} disabled={disabled} value={value} onChange={()=>{}} onFocus={()=>trigger.current?.focus()}/>
  </span>;
}
