"use client";
import { Children, Fragment, isValidElement, type ReactNode, type ComponentProps } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
// Option markup is retained at call sites; Radix owns selection, keyboard and focus.
type Option = { value:string; label:ReactNode; disabled?:boolean };
function optionsFrom(children:ReactNode):Option[] {
  return Children.toArray(children).flatMap(child=>{
    if(!isValidElement<{value?:string|number;children?:ReactNode;disabled?:boolean}>(child)) return [];
    if(child.type===Fragment) return optionsFrom(child.props.children);
    return [{value:String(child.props.value ?? child.props.children ?? ""),label:child.props.children,disabled:child.props.disabled}];
  });
}
export function SelectField({value,defaultValue,onValueChange,children,disabled,required,name,className,...props}: Omit<ComponentProps<typeof SelectTrigger>,"value"|"defaultValue"|"onChange"|"children"> & {value?:string|number;defaultValue?:string|number;onValueChange:(value:string)=>void;children:ReactNode;required?:boolean;name?:string}) {
  const encode=(value:string|number)=>String(value)==="" ? "__all__" : String(value);
  const options=optionsFrom(children);
  const selection=(value:string|number)=>required && String(value)==="" ? "" : encode(value);
  return <Select value={value===undefined ? undefined : selection(value)} defaultValue={defaultValue===undefined ? undefined : selection(defaultValue)} onValueChange={next=>onValueChange(next==="__all__" ? "" : next)} disabled={disabled} required={required} name={name}>
    <SelectTrigger className={`select-field ${className ?? ""}`} {...props}><SelectValue placeholder={options.find(option=>option.value==="")?.label ?? "请选择"}/></SelectTrigger>
    <SelectContent position="popper">{options.map(option=><SelectItem key={option.value} value={encode(option.value)} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectContent>
  </Select>;
}
