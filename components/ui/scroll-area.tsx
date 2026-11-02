'use client';

import {useEffect,useRef,type ReactNode,type ComponentProps} from 'react';
import {ScrollArea as ScrollAreaPrimitive} from 'radix-ui';
import {cn} from '@/lib/utils';

/** Native scrolling with draggable overlay thumbs; never reserves a gutter. */
export function ScrollArea({children,className,viewportClassName,viewportLabel,header,...props}:ComponentProps<typeof ScrollAreaPrimitive.Root>&{viewportClassName?:string;viewportLabel:string;header?:ReactNode}) {
 const headerRef=useRef<HTMLDivElement>(null);
 const pointer=useRef<{target:HTMLElement;id:number}|null>(null);
 useEffect(()=>{
  const release=()=>{pointer.current=null;};
  // Radix releases its drag styles on pointerup; forward cancellation to that path.
  const cancel=()=>{const active=pointer.current;if(active){pointer.current=null;active.target.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:active.id}));}};
  window.addEventListener('pointerup',release);
  window.addEventListener('pointercancel',cancel);
  window.addEventListener('blur',cancel);
  return()=>{cancel();window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);};
 },[]);
 // Radix waits 100ms to detect scroll end, then 700ms: 800ms total idle delay.
 return <ScrollAreaPrimitive.Root {...props} type="scroll" scrollHideDelay={700} className={cn('overlay-scroll-area',className)}>
  {header&&<div ref={headerRef} className="overlay-scroll-header">{header}</div>}
  <ScrollAreaPrimitive.Viewport className={cn('overlay-scroll-viewport',viewportClassName)} tabIndex={0} aria-label={viewportLabel} onScroll={event=>{if(headerRef.current)headerRef.current.scrollLeft=event.currentTarget.scrollLeft;}}>{children}</ScrollAreaPrimitive.Viewport>
  {(['vertical','horizontal'] as const).map(orientation=><ScrollAreaPrimitive.Scrollbar key={orientation} orientation={orientation} forceMount className="overlay-scrollbar" onPointerDownCapture={event=>{if(event.button===0)pointer.current={target:event.target as HTMLElement,id:event.pointerId};}}>
   <ScrollAreaPrimitive.Thumb className="overlay-scroll-thumb"/>
  </ScrollAreaPrimitive.Scrollbar>)}
 </ScrollAreaPrimitive.Root>;
}
