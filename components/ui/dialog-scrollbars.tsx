'use client';

import {useLayoutEffect,useRef} from 'react';

/** Overlay thumbs for native dialog scrollports, without wrapping or moving form controls. */
export function DialogScrollbars(){
 const layerRef=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const layer=layerRef.current,dialog=layer?.parentElement;
  if(!layer||!dialog)return;
  type Port={element:HTMLElement;bars:HTMLDivElement[];timer?:ReturnType<typeof setTimeout>;hovered:boolean;dragging:boolean;originalTabindex:string|null;keyboardNative:boolean;cleanup:()=>void};
  const ports=new Map<HTMLElement,Port>();
  let frame=0,disposed=false;
  const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(refresh);};
  const hideLater=(port:Port)=>{
   clearTimeout(port.timer);
   port.timer=setTimeout(()=>{if(!port.hovered&&!port.dragging)port.bars.forEach(bar=>bar.dataset.active='false');},800);
  };
  const show=(port:Port)=>{port.bars.forEach(bar=>bar.dataset.active='true');hideLater(port);};
  const add=(element:HTMLElement)=>{
   const previousTabindex=element.getAttribute('tabindex');
   const keyboardNative=element.matches('textarea,input,[contenteditable=true]');
   const port:Port={element,bars:[],hovered:false,dragging:false,originalTabindex:previousTabindex,keyboardNative,cleanup:()=>{}};
   const releases:(()=>void)[]=[];
   for(const axis of ['vertical','horizontal'] as const){
    const bar=document.createElement('div'),thumb=document.createElement('div');
    bar.className='dialog-scrollbar';bar.dataset.orientation=axis;bar.dataset.active='false';
    thumb.className='dialog-scroll-thumb';thumb.setAttribute('aria-hidden','true');
    bar.append(thumb);layer.append(bar);port.bars.push(bar);
    let pointer:number|undefined,start=0,offset=0;
    const vertical=axis==='vertical';
    const release=()=>{
     if(pointer!==undefined&&thumb.hasPointerCapture(pointer))thumb.releasePointerCapture(pointer);
     pointer=undefined;port.dragging=false;hideLater(port);
    };
    releases.push(release);
    thumb.addEventListener('pointerenter',()=>{port.hovered=true;show(port);});
    thumb.addEventListener('pointerleave',()=>{port.hovered=false;hideLater(port);});
    thumb.addEventListener('pointerdown',event=>{
     if(event.button!==0)return;
     event.preventDefault();event.stopPropagation();
     pointer=event.pointerId;start=vertical?event.clientY:event.clientX;offset=vertical?element.scrollTop:element.scrollLeft;
     port.dragging=true;thumb.setPointerCapture(pointer);show(port);
    });
    thumb.addEventListener('pointermove',event=>{
     if(pointer!==event.pointerId)return;
     const track=bar.getBoundingClientRect(),handle=thumb.getBoundingClientRect();
     const travel=vertical?track.height-handle.height:track.width-handle.width;
     const extent=vertical?element.scrollHeight-element.clientHeight:element.scrollWidth-element.clientWidth;
     if(travel<=0)return;
     const value=offset+((vertical?event.clientY:event.clientX)-start)*extent/travel;
     if(vertical)element.scrollTop=value;else element.scrollLeft=value;
    });
    thumb.addEventListener('pointerup',release);
    thumb.addEventListener('pointercancel',()=>{port.hovered=false;release();});
    thumb.addEventListener('lostpointercapture',release);
   }
   const scroll=()=>{show(port);schedule();};
   element.addEventListener('scroll',scroll,{passive:true});
   element.dataset.dialogScrollport='';
   port.cleanup=()=>{
    releases.forEach(release=>release());clearTimeout(port.timer);
    element.removeEventListener('scroll',scroll);delete element.dataset.dialogScrollport;
    if(previousTabindex===null&&!keyboardNative)element.removeAttribute('tabindex');
    port.bars.forEach(bar=>bar.remove());
   };
   ports.set(element,port);
   return port;
  };
  const resize=new ResizeObserver(schedule);
  const observed=new Set<Element>();
  function refresh(){
   frame=0;if(disposed)return;
   const rootRect=dialog!.getBoundingClientRect();
   const scaleX=rootRect.width/dialog!.offsetWidth||1,scaleY=rootRect.height/dialog!.offsetHeight||1;
   const nodes=[dialog!,...dialog!.querySelectorAll<HTMLElement>('*')].filter(el=>!layer!.contains(el)&&el!==layer);
   const found=new Set<HTMLElement>();
   for(const element of nodes){
    if(!observed.has(element)){observed.add(element);resize.observe(element);}
    if(element.matches('.overlay-scroll-area,[data-radix-scroll-area-viewport]'))continue;
    const css=getComputedStyle(element);
    if(![css.overflowX,css.overflowY].some(value=>/^(auto|scroll)$/.test(value)))continue;
    found.add(element);
    const port=ports.get(element)??add(element),rect=element.getBoundingClientRect();
    if(port.originalTabindex===null&&!port.keyboardNative){
     if(element.scrollHeight>element.clientHeight+1||element.scrollWidth>element.clientWidth+1)element.tabIndex=0;
     else element.removeAttribute('tabindex');
    }
    let top=rect.top+element.clientTop*scaleY,left=rect.left+element.clientLeft*scaleX;
    let right=left+element.clientWidth*scaleX,bottom=top+element.clientHeight*scaleY;
    // Clip nested scrollports to their visible ancestors, including the dialog body.
    for(let ancestor=element.parentElement;ancestor&&dialog!.contains(ancestor);ancestor=ancestor.parentElement){
     const style=getComputedStyle(ancestor),bounds=ancestor.getBoundingClientRect();
     if(/auto|scroll|hidden|clip/.test(style.overflowY)){top=Math.max(top,bounds.top);bottom=Math.min(bottom,bounds.bottom);}
     if(/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,bounds.left);right=Math.min(right,bounds.right);}
    }
    top=Math.max(top,rootRect.top);bottom=Math.min(bottom,rootRect.bottom);left=Math.max(left,rootRect.left);right=Math.min(right,rootRect.right);
    const header=element.querySelector<HTMLElement>(':scope > table > thead');
    const stickyCell=header?.querySelector<HTMLElement>('th');
    const headerBottom=stickyCell&&getComputedStyle(stickyCell).position==='sticky'?stickyCell.getBoundingClientRect().bottom:top;
    port.bars.forEach((bar,index)=>{
     const vertical=index===0,client=vertical?element.clientHeight:element.clientWidth,total=vertical?element.scrollHeight:element.scrollWidth;
     const overflow=vertical?css.overflowY:css.overflowX;
     const trackTop=vertical?Math.max(top,headerBottom):top;
     const length=(vertical?(bottom-trackTop)/scaleY:(right-left)/scaleX)-(vertical||element.scrollHeight<=element.clientHeight+1?16:24);
     const available=/^(auto|scroll)$/.test(overflow)&&total>client+1&&length>24&&right>left&&bottom>top&&css.visibility!=='hidden';
     bar.hidden=!available;if(!available)return;
     const size=Math.min(length,Math.max(28,length*client/total));
     const position=Math.max(0,Math.min(1,(vertical?element.scrollTop:element.scrollLeft)/(total-client)))*(length-size);
     Object.assign(bar.style,vertical?{left:`${(right-rootRect.left)/scaleX-12+dialog!.scrollLeft}px`,top:`${(trackTop-rootRect.top)/scaleY+8+dialog!.scrollTop}px`,height:`${length}px`,width:'8px'}:{left:`${(left-rootRect.left)/scaleX+8+dialog!.scrollLeft}px`,top:`${(bottom-rootRect.top)/scaleY-12+dialog!.scrollTop}px`,width:`${length}px`,height:'8px'});
     Object.assign((bar.firstElementChild as HTMLElement).style,vertical?{height:`${size}px`,width:'8px',transform:`translateY(${position}px)`}:{width:`${size}px`,height:'8px',transform:`translateX(${position}px)`});
    });
   }
   for(const [element,port] of ports)if(!found.has(element)){port.cleanup();ports.delete(element);}
   for(const element of observed)if(!dialog!.contains(element)&&element!==dialog){resize.unobserve(element);observed.delete(element);}
  }
  const mutation=new MutationObserver(records=>{if(records.some(record=>!layer.contains(record.target)))schedule();});
  mutation.observe(dialog,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','open','value']});
  const blur=()=>{for(const port of ports.values()){port.hovered=false;port.dragging=false;for(const bar of port.bars){const thumb=bar.firstElementChild as HTMLElement;thumb.dispatchEvent(new Event('pointercancel'));}hideLater(port);}};
  dialog.addEventListener('scroll',schedule,true);
  dialog.addEventListener('input',schedule,true);
  dialog.addEventListener('animationend',schedule);
  window.addEventListener('resize',schedule);
  window.addEventListener('blur',blur);
  refresh();
  return()=>{
   disposed=true;cancelAnimationFrame(frame);mutation.disconnect();resize.disconnect();
   dialog.removeEventListener('scroll',schedule,true);dialog.removeEventListener('input',schedule,true);dialog.removeEventListener('animationend',schedule);
   window.removeEventListener('resize',schedule);window.removeEventListener('blur',blur);
   ports.forEach(port=>port.cleanup());
  };
 },[]);
 return <div className="dialog-scrollbar-layer" ref={layerRef} aria-hidden="true"/>;
}
