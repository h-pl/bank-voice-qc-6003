import {upgradeUntouchedPolicyPresets} from "./policy-presets.ts";
import {useSyncExternalStore} from "react";
import {reconcileAlerts} from "./call-alerts.ts";
import {createPrototypeState} from "./prototype-seeds.ts";
import {defaultView,nav,person,type State} from "./workflow.ts";
export const storageKey="moss-qc-6003";
const initial=createPrototypeState(new Date("2026-10-31T00:00:00Z"));
let cache:State|undefined;
export const getServerSnapshot=()=>initial;
export function getSnapshot():State {
 if(typeof window==="undefined")return initial;
 if(!cache){
  try {const d=JSON.parse(localStorage.getItem(storageKey)||"null");if(d?.schema===2&&d.policies&&d.alerts&&person(d.identity))cache=d;}catch{}
  cache ??=createPrototypeState();
  cache=reconcileAlerts(upgradeUntouchedPolicyPresets(cache));
  const query=new URLSearchParams(location.search).get("view") as State["view"];
  cache={...cache,view:nav[person(cache.identity).role].includes(query)?query:defaultView};
 }
 return cache;
}
export function subscribe(fn:()=>void){const sync=()=>{cache=undefined;fn();};window.addEventListener("storage",sync);window.addEventListener("qc-state",fn);return()=>{window.removeEventListener("storage",sync);window.removeEventListener("qc-state",fn);};}
export function updateState(s:State){
 try{localStorage.setItem(storageKey,JSON.stringify(s));}catch{throw new Error("保存失败，请释放浏览器存储空间后重试；输入内容已保留。");}
 cache=s;window.dispatchEvent(new Event("qc-state"));return true;
}
export function resetState(){const s=createPrototypeState();updateState(s);history.replaceState(null,"",`?view=${defaultView}`);return s;}
let clockTime = Date.now();
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | undefined;
function subscribeClock(fn: () => void) {
  clockListeners.add(fn);
  if (!clockTimer)
    clockTimer = setInterval(() => {
      clockTime = Date.now();
      clockListeners.forEach((f) => f());
    }, 1000);
  return () => {
    clockListeners.delete(fn);
    if (!clockListeners.size) {
      clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}
export function useDemoClock() {
  return useSyncExternalStore(
    subscribeClock,
    () => clockTime,
    () => Date.parse("2026-09-12T00:00:00+08:00"),
  );
}
