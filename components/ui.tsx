"use client";
import { RecordText } from "./record-id";
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button as ShadcnButton } from "./ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { InputGroup, InputGroupInput } from "./ui/input-group";
import { Badge as ShadcnBadge } from "./ui/badge";
import { Tabs as TabsRoot, TabsList, TabsTrigger } from "./ui/tabs";
import { Icon, type IconName } from "./icon";
export function PageHeader({title, description, children}: {title:ReactNode; description:string; children?:ReactNode}) {
  return <header className="catalog-heading page-section-header"><div><h2>{title}</h2><p>{description}</p></div>{children}</header>;
}
export function MetricSummary({items, selected, onSelect, label}: {items:{key:string;label:string;value:ReactNode;hint:string}[];selected:string;onSelect:(key:string)=>void;label:string}) {
  return <div className="metric-summary" role="group" aria-label={label} style={{gridTemplateColumns:`repeat(${items.length}, minmax(0, 1fr))`}}>{items.map(item=><ShadcnButton variant="ghost" className="metric-button" type="button" key={item.key} aria-pressed={selected===item.key} onClick={()=>onSelect(item.key)}><span>{item.label}</span><strong>{item.value}</strong><small>{item.hint}</small></ShadcnButton>)}</div>;
}
export function DetailNavigation({label, onBack, children}: {label:string; onBack:()=>void; children?:ReactNode}) {
  return <nav className="detail-backbar" aria-label="详情导航"><ShadcnButton variant="ghost" type="button" className="detail-back-link" onClick={onBack}><Icon name="arrow" size={16}/><span>{label}</span></ShadcnButton>{children && <div className="detail-back-actions">{children}</div>}</nav>;
}
export function Button({
  children,
  onClick,
  icon,
  primary = false,
  disabled = false,
  type = "button",
  intent = "neutral",
  busy = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: IconName;
  primary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  intent?: "neutral" | "danger";
  busy?: boolean;
}) {
  return (
    <ShadcnButton
      variant={intent === "danger" ? "destructive" : primary ? "default" : "outline"}
      type={type}
      className={`btn ${primary ? "primary" : ""} ${intent === "danger" ? "danger" : ""}`}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy && <span className="button-spinner" aria-hidden="true" />}
      {icon && !busy && <Icon name={icon} size={15} />}
      <span>{children}</span>
    </ShadcnButton>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <ShadcnBadge variant="secondary" className={`badge ${tone}`}>
      <i />
      {children}
    </ShadcnBadge>
  );
}
export function Empty({
  text = "没有符合条件的记录",
  hint = "试试调整搜索或筛选条件。",
  action,
}: {
  text?: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name="file" size={30} />
      <b>{text}</b>
      <p>{hint}</p>
      {action}
    </div>
  );
}
const ModalLayerContext = createContext<(() => () => void) | null>(null);

export function Modal({
  title,
  children,
  onClose,
  variant = "default",
  description,
  titleAside,
  footer,
  containEscape = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  variant?: "default" | "notification" | "navigation" | "evidence" | "resource" | "action" | "record";
  description?: string;
  titleAside?: ReactNode;
  footer?: ReactNode;
  containEscape?: boolean;
}) {
  const parentLayer = useContext(ModalLayerContext);
  const [childCount, setChildCount] = useState(0);
  const registerChild = useCallback(() => {
    setChildCount(count => count + 1);
    return () => setChildCount(count => Math.max(0, count - 1));
  }, []);
  const descriptionId = useId();
  const prior = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    prior.current ??= document.activeElement as HTMLElement | null;
    return parentLayer?.();
  }, [parentLayer]);
  return <ModalLayerContext.Provider value={registerChild}><Dialog open onOpenChange={open=>{if(!open)onClose();}}>
    <DialogContent ref={content} layerCovered={childCount > 0} layerNested={!!parentLayer} showCloseButton={false} className={`modal ${variant}-dialog`} aria-describedby={description ? descriptionId : undefined} onOpenAutoFocus={event=>{ prior.current ??= document.activeElement as HTMLElement | null; event.preventDefault(); content.current?.focus({preventScroll:true}); }} onCloseAutoFocus={event=>{event.preventDefault();const target=prior.current;requestAnimationFrame(()=>{if(target?.isConnected)target.focus({preventScroll:true});});}} onPointerDownOutside={event=>event.preventDefault()} onEscapeKeyDown={event=>{
      // Base UI popups handle Escape after Radix's capture listener. Keep the parent open.
      const openDialogs = document.querySelectorAll('[data-slot="dialog-content"][data-state="open"]');
      if(openDialogs[openDialogs.length - 1] !== content.current) { event.preventDefault(); return; }
      const target=event.target;
      if(target instanceof Element && target.closest('[role="dialog"]')?.querySelector('[data-slot="combobox-chip-input"][aria-expanded="true"]')) { event.preventDefault(); return; }
      if(document.querySelector('[data-slot="tooltip-content"][data-state$="open"]')) { event.preventDefault(); return; }
      if(containEscape) { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
    }}>
      <header><div className={titleAside ? "modal-heading-with-aside" : undefined}><DialogTitle>{title}</DialogTitle>{titleAside}{description && <DialogDescription id={descriptionId} className="modal-description"><RecordText text={description}/></DialogDescription>}</div><ShadcnButton type="button" variant="ghost" size="icon" className="icon-button" aria-label="关闭弹窗" onClick={onClose}><Icon name="close"/></ShadcnButton></header>
      {variant === "action" ? children : <><div className="modal-body">{children}</div>{variant !== "navigation" && <div className="modal-actions">{footer ?? <Button onClick={onClose}>{parentLayer ? "返回上一级" : "关闭"}</Button>}</div>}</>}
    </DialogContent>
  </Dialog></ModalLayerContext.Provider>;
}


/** Local filtering stays synchronous; an IME candidate is committed only at compositionend. */
export function SearchField({ value, onValueChange, label, placeholder, name }: {
  value: string; onValueChange: (value: string) => void | boolean;
  label: string; placeholder: string; name: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  useEffect(() => { if (input.current && !composing.current) input.current.value = value; }, [value]);
  const commit = (next: string) => {
    const accepted = onValueChange(next) !== false;
    if (input.current) input.current.value = accepted ? next : value;
  };
  return <InputGroup className="search-box">
    <Icon name="search" size={17}/>
    <InputGroupInput ref={input} type="search" name={name} aria-label={label} autoComplete="off" placeholder={placeholder} defaultValue={value}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={e => { composing.current = false; commit(e.currentTarget.value); }}
      onChange={e => { if (!composing.current) commit(e.currentTarget.value); }}
      onKeyDown={e => { if (e.key === "Escape" && !e.nativeEvent.isComposing && !composing.current) { e.preventDefault(); commit(""); } }}/>
    <ShadcnButton variant="ghost" size="icon-sm" className="search-clear" type="button" aria-label={`清除${label}`} title={`清除${label}`} disabled={!value} style={{visibility:value ? "visible" : "hidden"}} onClick={() => { composing.current = false; commit(""); input.current?.focus(); }}><Icon name="close" size={15}/></ShadcnButton>
  </InputGroup>;
}

export function Tabs<T extends string>({ value, options, onChange, label, panelId, className = "tabs" }: {
  value: T; options: ReadonlyArray<{value:T; label:ReactNode; count?:number}>;
  onChange:(value:T) => void; label:string; panelId:string; className?:string;
}) {
  return <TabsRoot value={value} onValueChange={next=>onChange(next as T)} className="tabs-root">
    <TabsList variant="line" className={`ui-tabs ${className}`} aria-label={label}>
      {options.map(option=><TabsTrigger key={option.value} value={option.value}
        id={`${panelId}-tab-${option.value}`} aria-controls={panelId}
        className={value === option.value ? "active" : ""}>
        {option.label}{option.count !== undefined && <span>{option.count}</span>}
      </TabsTrigger>)}
    </TabsList>
  </TabsRoot>;
}

export function InlineFormSurface({title, children, onClose}: {title:string;children:ReactNode;onClose:()=>void}) {
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus();},[]);
  return <section className="inline-editor panel" aria-label={title}><header><div><p>业务资源 / 内容维护</p><h2 ref={heading} tabIndex={-1}>{title}</h2></div><Button onClick={onClose}>返回资源</Button></header>{children}</section>;
}
