"use client";
import { useEffect, useRef, useState } from "react";
import { CopyRecordId, RecordText, RecordRow } from "./record-id";
import { businessRecordText } from "../lib/timeline-presentation";
import { Bell, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import type { State } from "../lib/workflow";

export function NotificationCenter({events,readIds,open,onOpenChange,onRead,onReadAll,onUndoRead,onNavigate}:{events:State["logs"];readIds:string[];open:boolean;onOpenChange:(open:boolean)=>void;onRead:(id:string)=>void;onReadAll:()=>string[];onUndoRead:(ids:string[])=>void;onNavigate:(target:string)=>void}) {
  const [feedback,setFeedback]=useState<{message:string;canUndo:boolean}|null>(null);
  const undoIds=useRef<string[]>([]);
  const undoButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if (!feedback) return;
    if (feedback.canUndo) undoButton.current?.focus({preventScroll:true});
    const timer=setTimeout(()=>{undoIds.current=[];setFeedback(null);},8000);
    return ()=>clearTimeout(timer);
  },[feedback]);
  function markAllRead() {
    const ids=onReadAll();
    if (!ids.length) return;
    undoIds.current=ids;
    setFeedback({message:"已全部标记为已读",canUndo:true});
  }
  function undoAllRead() {
    onUndoRead(undoIds.current);
    undoIds.current=[];
    setFeedback({message:"已撤销全部已读",canUndo:false});
  }
  function markRead(id:string) {
    undoIds.current=undoIds.current.filter(item=>item!==id);
    onRead(id);
  }
  const unread=events.filter(event=>!readIds.includes(event.id)).length;
  return <Popover open={open} onOpenChange={onOpenChange}><PopoverTrigger asChild><Button variant="ghost" size="icon" className="notification-button" aria-label={`通知中心，${unread} 条未读`}><Bell size={18}/>{unread>0 && <span aria-hidden="true">{unread>99 ? "99+" : unread}</span>}</Button></PopoverTrigger>
    <PopoverContent align="end" className="notification-popover" sideOffset={10} collisionPadding={12} aria-label="通知中心">
      <header><h2>通知中心</h2><span role="status">{unread ? `${unread} 条未读` : "全部已读"}</span>{unread>0 && <Button variant="link" size="sm" className="notification-read-all" onClick={markAllRead}>全部已读</Button>}<Button variant="ghost" size="icon" className="notification-close" aria-label="关闭通知中心" onClick={()=>onOpenChange(false)}><X size={16}/></Button></header>
      {feedback && <div className="notification-feedback"><span role="status">{feedback.message}</span>{feedback.canUndo && <Button ref={undoButton} variant="link" size="sm" onClick={undoAllRead}>撤销</Button>}</div>}
      <div className="notification-list">{events.length ? events.map(event=>{
        const isUnread=!readIds.includes(event.id);
        return <article key={event.id} data-unread={isUnread}>
          <RecordRow label={`查看通知：${businessRecordText(event.action)}`} className="notification-event" tooltip={businessRecordText(event.note)} onOpen={()=>{markRead(event.id);onNavigate(event.target);onOpenChange(false);}}>
            <div className="notification-content">
              <div className="notification-title-row"><strong>{isUnread && <span className="notification-unread-dot" aria-label="未读"/>}{businessRecordText(event.action)}</strong><time dateTime={event.at}>{new Date(event.at).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false})}</time></div>
              <p><RecordText text={event.note}/></p>
            </div>
          </RecordRow>
          <div className="notification-meta"><CopyRecordId id={event.target}/>
            {isUnread ? <Button variant="link" size="sm" aria-label={`标记已读：${businessRecordText(event.action)}`} onClick={()=>markRead(event.id)}>标记已读</Button> : <span className="notification-read-state">已读</span>}
          </div>
        </article>;
      }) : <p className="notification-empty">暂无通知</p>}</div>
    </PopoverContent>
  </Popover>;
}
