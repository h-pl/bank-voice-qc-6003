"use client";
import { useState, type ReactNode } from "react";
import { Button } from "./ui/button";
import { Icon } from "./icon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

export function ResourceHint({label,children}:{label:string;children:ReactNode}) {
 const [open,setOpen]=useState(false);
 return <TooltipProvider><Tooltip open={open} onOpenChange={setOpen}>
  <TooltipTrigger asChild><Button type="button" variant="ghost" size="icon-xs" className="resource-hint" aria-label={label} onClick={event=>{event.preventDefault();setOpen(true);}}><Icon name="info" size={15}/></Button></TooltipTrigger>
  <TooltipContent side="top" align="start" sideOffset={6} className="resource-hint-content">{children}</TooltipContent>
 </Tooltip></TooltipProvider>;
}
