"use client";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./ui/collapsible";
import { Button } from "./ui/button";
export function Disclosure({title,children,className=""}:{title:ReactNode;children:ReactNode;className?:string}) {
  return <Collapsible className={`disclosure ${className}`}><CollapsibleTrigger asChild><Button variant="ghost" className="disclosure-trigger"><span>{title}</span><ChevronDown size={16}/></Button></CollapsibleTrigger><CollapsibleContent>{children}</CollapsibleContent></Collapsible>;
}
