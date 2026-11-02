'use client';

import {useEffect,useRef,useState,type ReactElement} from 'react';
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from './ui/tooltip';

/** Collapsed navigation labels respond only to deliberate pointer/keyboard access. */
export function SidebarHint({label,enabled,children,side="right"}:{label:string;enabled:boolean;children:ReactElement;side?:"right"|"bottom"}) {
 const [open,setOpen]=useState(false);
 const keyboardIntent=useRef(false);
 useEffect(()=>{
  const close=()=>{keyboardIntent.current=false;setOpen(false);};
  const key=(event:KeyboardEvent)=>{keyboardIntent.current=event.key==="Tab";};
  const pointer=()=>{keyboardIntent.current=false;};
  document.addEventListener("keydown",key,true);
  document.addEventListener("pointerdown",pointer,true);
  window.addEventListener('blur',close);
  document.addEventListener('visibilitychange',close);
  return()=>{document.removeEventListener("keydown",key,true);document.removeEventListener("pointerdown",pointer,true);window.removeEventListener('blur',close);document.removeEventListener('visibilitychange',close);};
 },[]);
 return <TooltipProvider delayDuration={250} disableHoverableContent><Tooltip open={enabled&&open} onOpenChange={setOpen}>
  <TooltipTrigger asChild onFocus={event=>{if(!keyboardIntent.current)event.preventDefault();keyboardIntent.current=false;}}>{children}</TooltipTrigger>
  {enabled&&<TooltipContent side={side} sideOffset={8} style={{pointerEvents:"none"}}>{label}</TooltipContent>}
 </Tooltip></TooltipProvider>;
}
