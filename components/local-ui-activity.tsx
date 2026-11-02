'use client';
import {useEffect} from 'react';

/** Activity feedback is scoped to the newly updated workspaces and dialogs. */
export function LocalUiActivity() {
 useEffect(()=>{
  const timers=new Map<HTMLElement,ReturnType<typeof setTimeout>>();
  let dragging:HTMLElement|undefined;
  const finish=(element:HTMLElement)=>{clearTimeout(timers.get(element));timers.set(element,setTimeout(()=>{element.removeAttribute('data-scroll-active');timers.delete(element);},800));};
  const show=(element:HTMLElement)=>{clearTimeout(timers.get(element));element.setAttribute('data-scroll-active','');if(dragging!==element)finish(element);};
  const scroll=(event:Event)=>{const element=event.target;if(element instanceof HTMLElement&&element.closest('.ui6003'))show(element);};
  const down=(event:PointerEvent)=>{
   const element=event.target;if(!(element instanceof HTMLElement)||!element.closest('.ui6003'))return;
   const rect=element.getBoundingClientRect();
   if(element.scrollHeight>element.clientHeight&&event.clientX>=rect.right-12||element.scrollWidth>element.clientWidth&&event.clientY>=rect.bottom-12){dragging=element;show(element);}
  };
  const release=()=>{if(dragging){finish(dragging);dragging=undefined;}};
  document.addEventListener('scroll',scroll,true);document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',release,true);document.addEventListener('pointercancel',release,true);window.addEventListener('blur',release);
  return()=>{document.removeEventListener('scroll',scroll,true);document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',release,true);document.removeEventListener('pointercancel',release,true);window.removeEventListener('blur',release);timers.forEach((timer,element)=>{clearTimeout(timer);element.removeAttribute('data-scroll-active');});dragging?.removeAttribute('data-scroll-active');};
 },[]);
 return null;
}
