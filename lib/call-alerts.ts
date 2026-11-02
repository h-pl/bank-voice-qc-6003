import {flowOwner} from './flow-routing.ts';
import { people, latest, terminalRemedy, terminalAppeal, currentOwner, roleOf, entity, type State, type Finding, type DetectionHit, type RiskLevel, type Command, type CallAlert } from './workflow.ts';
import { policyFor } from './configuration.ts';
import { createAlertTiming } from './alert-deadlines.ts';
import { ensureSystemSettings } from './configuration-schema.ts';
import { currentTaskContext } from './case-context.ts';
import { supportsWarning } from './strategy-schema.ts';
const rank:Record<RiskLevel,number>={none:0,low:1,medium:2,high:3};
const highest=(levels:RiskLevel[]):RiskLevel=>levels.reduce((a,b)=>rank[a]>=rank[b]?a:b,'none');
// Discovery source stays immutable; a manually discovered problem can later carry automatic hits.
const hasAutomaticHit=(f:Finding)=>f.source==='auto'||!!f.hits?.length;
export const alertStatusLabel=(a:CallAlert)=>({pending:'待处理',open:'处理中',closed:'已关闭'})[a.status];
export const alertResultLabel=(a:CallAlert)=>a.closeResult==='excluded'?'全部排除':a.closeResult==='resolved'?'处理完成':'—';

export function problemFinished(s:State,f:Finding){
 if(s.appeals.some(a=>a.findingId===f.id&&!terminalAppeal(a)))return false;
 if(s.remedies.some(r=>r.findingId===f.id&&!terminalRemedy(r)))return false;
 if(s.reviews.some(r=>r.findingIds.includes(f.id)&&!['done','cancelled'].includes(r.status)))return false;
 if(s.supplements.some(x=>x.target===f.id&&['pending','submitted'].includes(x.status)))return false;
 if(f.reopenedAt&&['candidate','reminded','review','supplement'].includes(f.status)&&(!latest(f)||latest(f)!.at<=f.reopenedAt))return false;
 if(latest(f)?.value==='false_positive'||f.status==='closed')return true;
 if(f.distribution?.status==='pending')return false;
 return !!latest(f)?.noRemedy || s.remedies.some(r=>r.findingId===f.id&&r.status==='done'&&r.conclusionSequence===latest(f)?.sequence);
}
/** Retain the original problem and create independent hit records for every batch. */
export function ensureDetectionHistory(s:State) {
 ensureSystemSettings(s);
 for(const f of s.findings.filter(f=>f.source==='auto')){
  f.problemKey??=f.detectionKey?.slice(f.ruleId.length+1)??f.id;
  if(f.hits)continue;
  f.hits=[{id:`HIT-${f.id}`,eventKey:`existing:${f.id}`,batchId:f.batchId,ruleId:f.ruleId,at:f.alertTiming?.triggeredAt??f.basis?.capturedAt??s.calls.find(c=>c.id===f.callId)?.startedAt??new Date(0).toISOString(),evidence:[...f.evidence],feature:f.basis?.conditions.find(c=>c.enabled!==false)?.feature??'指标命中',basis:f.basis?structuredClone(f.basis):undefined,policy:{name:f.workflow?.policyName??'历史记录未保存策略详情',level:f.severity,recipients:[],method:'notification',flowId:f.workflow?.flowId??'default'},legacy:true}];
 }
 return s;
}
export function problemStage(s:State,f:Finding) {
 if(problemFinished(s,f))return '已办结';
 if(s.appeals.some(a=>a.findingId===f.id&&!terminalAppeal(a)))return '申诉';
 if(s.remedies.some(r=>r.findingId===f.id&&!terminalRemedy(r)))return '整改';
 if(f.distribution?.status==='pending')return '待回应';
 return ['review','supplement'].includes(f.status)?'核实中':'待初审';
}
export function alertSummary(s:State,a:CallAlert,now=new Date()) {
 const problems=s.findings.filter(f=>a.problemIds.includes(f.id));
 const stages=Object.fromEntries(['待初审','核实中','待回应','申诉','整改','已办结'].map(stage=>[stage,problems.filter(f=>problemStage(s,f)===stage).length]));
 const active=problems.filter(f=>!problemFinished(s,f));
 const tasks=[...active,...s.reviews.filter(r=>r.findingIds.some(id=>active.some(f=>f.id===id))&&!['done','cancelled'].includes(r.status)),...s.appeals.filter(r=>active.some(f=>f.id===r.findingId)&&!terminalAppeal(r)),...s.remedies.filter(r=>active.some(f=>f.id===r.findingId)&&!terminalRemedy(r)),...s.supplements.filter(r=>['pending','submitted'].includes(r.status)&&active.some(f=>f.id===r.target))];
 const deadlines=tasks.map(item=>currentTaskContext(s,item).dueAt).filter((v):v is string=>!!v).sort();
 const overdue=active.filter(f=>tasks.some(t=>(t.id===f.id||'findingId'in t&&t.findingId===f.id||'findingIds'in t&&t.findingIds.includes(f.id))&&!!currentTaskContext(s,t).dueAt&&Date.parse(currentTaskContext(s,t).dueAt!)<=now.getTime())).length;
 return {stages,earliestDeadline:deadlines[0],overdue,owners:[...new Set(tasks.map(t=>currentOwner(s,t)).filter(Boolean))],waitingReason:active.some(f=>!hasAutomaticHit(f))?'待人工问题处理':'等待检测完成'};
}
export function detectionComplete(s:State,callId:string) {
 const call=s.calls.find(c=>c.id===callId),batch=call?.batches.at(-1);
 return !!call?.endedAt&&!!batch&&(call.manualDetection?.batchId===batch.id||!!batch.checks.length&&batch.checks.every(x=>x.state==='success'));
}
// Resolve the recorded association, never the rule's newly assigned policy.
function currentHitLevel(s:State,hit:DetectionHit):Finding['severity'] {
 if(hit.policy.id)return s.policies.find(p=>p.id===hit.policy.id)?.level
  ??s.archivedPolicies?.find(p=>p.id===hit.policy.id)?.level??hit.policy.level;
 return hit.legacy?hit.policy.level:s.defaults.level;
}
export function reconcileAlerts(s:State,now=new Date(),reason='问题状态更新'):State {
 ensureDetectionHistory(s);s.alerts??=[];const at=now.toISOString();
 for(const f of s.findings.filter(x=>hasAutomaticHit(x)&&!problemFinished(s,x))){
  const level=highest(f.hits?.length?f.hits.map(hit=>currentHitLevel(s,hit)):[f.severity]) as Finding['severity'];
  if(f.severity===level)continue;
  const prior=f.severity;f.severity=level;f.rev++;
  // Only unfinished warning triage/disposition clocks are tightened. Appeal checks use their own deadlines.
  if(f.alertTiming&&rank[level]>rank[prior]&&!f.distribution&&['candidate','reminded','review','supplement'].includes(f.status)&&!s.appeals.some(a=>a.findingId===f.id&&!terminalAppeal(a))){
   const next=createAlertTiming(f.alertTiming.triggeredAt,level);
   f.alertTiming={...f.alertTiming,level,triageDueAt:[f.alertTiming.triageDueAt,next.triageDueAt].sort()[0],resolutionDueAt:[f.alertTiming.resolutionDueAt,next.resolutionDueAt].sort()[0]};
   for(const task of s.reviews.filter(r=>r.type==='candidate'&&r.findingIds.includes(f.id)&&!['done','cancelled'].includes(r.status))){
    const duration=Date.parse(next.resolutionDueAt)-Date.parse(next.triggeredAt),limit=new Date(Date.parse(f.alertTiming.resolutionDueAt)-duration*.2).toISOString();
    if(task.dueAt>limit){(task.deadlineChanges??=[]).push({from:task.dueAt,to:limit,at,reason:'预警升级，保留主管处置时间'});task.dueAt=limit;task.rev++;}
   }
  }
 }
 for(const call of s.calls){
  const fs=s.findings.filter(f=>f.callId===call.id);if(!fs.some(hasAutomaticHit))continue;
  let alert=s.alerts.find(a=>a.callId===call.id);
  if(!alert){const dates=fs.filter(hasAutomaticHit).flatMap(f=>f.hits?.map(h=>h.at)??[]).sort();alert={id:`AL-${call.id}`,rev:0,callId:call.id,problemIds:[],level:'none',status:'pending',createdAt:dates[0]??at,completed:0,history:[]};s.alerts.push(alert);}
  const open=fs.filter(f=>!problemFinished(s,f)),level=highest(open.filter(hasAutomaticHit).map(f=>f.severity));
  const processed=fs.some(f=>problemFinished(s,f)||!['candidate','reminded'].includes(f.status)||!!f.reopenedAt);
  const status=!open.length&&detectionComplete(s,call.id)?'closed':processed?'open':'pending';
  const closing=status==='closed'&&alert.status!=='closed';
  const closeResult=status==='closed'?(fs.every(f=>latest(f)?.value==='false_positive'||f.status==='closed')?'excluded':'resolved'):undefined;
  alert.highestLevel=highest([alert.highestLevel??'none',alert.level,level,...fs.flatMap(f=>f.hits?.map(h=>h.policy.level)??[])]);
  if(level!=='none')alert.lastActiveLevel=level;else if(alert.level!=='none')alert.lastActiveLevel=alert.level;
  if(closing){alert.closedAt=at;alert.closingLevel=alert.lastActiveLevel??alert.highestLevel;}
  if(status==='open'||status==='pending')delete alert.closedAt;
  if(alert.level!==level||alert.status!==status||alert.completed!==fs.length-open.length||alert.problemIds.length!==fs.length){
   alert.history.push({at,from:`${alert.status}/${alert.level}`,to:`${status}/${level}`,reason:`${reason}；已办结 ${fs.length-open.length}/${fs.length}`,findingIds:fs.map(f=>f.id),policyIds:[...new Set(fs.flatMap(f=>f.hits?.flatMap(h=>h.policy.id?[h.policy.id]:[])??[]))],closeResult});alert.rev++;
  }
  if(status==='closed'&&!alert.closingLevel)alert.closingLevel=alert.highestLevel;
  Object.assign(alert,{problemIds:fs.map(f=>f.id),completed:fs.length-open.length,level,status,closeResult});
 }
 return s;
}
export type DetectionEvent={key:string;problemKey:string;callId:string;batchId:string;ruleId:string;feature:string;count:number;duration:number;windowSeconds?:number;speed?:number;role:string;stage:string;atSecond:number;evidence:number[];title:string};
function sameEvidence(a:DetectionHit,b:DetectionHit) {
 const facts=(h:DetectionHit)=>({ruleId:h.ruleId,feature:h.feature,evidence:[...new Set(h.evidence)].sort((a,b)=>a-b),observation:h.observation,conditions:h.basis?.conditions,content:h.basis?.resource.content,knowledge:h.basis?.resource.knowledge});
 return JSON.stringify(facts(a))===JSON.stringify(facts(b));
}
function supervisorId(s:State,callId:string){return people.find(p=>p.role==='supervisor'&&s.calls.some(c=>c.id===callId))?.id??'S01';}
function notify(s:State,f:Finding,hit:DetectionHit,now:Date,fallback?:string,isNew=false){
 const call=s.calls.find(c=>c.id===f.callId)!,config=isNew?hit.policy:(f.hits?.[0]?.policy??hit.policy);
 const inspectorIds=config.inspectorIds??people.filter(p=>p.role==='inspector').map(p=>p.id);
 const recipients=people.filter(p=>config.recipients.includes(p.role)&&(p.role==='agent'?p.id===call.agentId:p.role==='supervisor'?p.id===supervisorId(s,call.id):inspectorIds.includes(p.id))).map(p=>p.id);
 const interval=config.reminderIntervalSeconds??0,at=now.toISOString();s.notificationDeliveries??=[];
 const sent:string[]=[];
 for(const recipient of recipients){
  const key=`${call.id}:${config.id??'default'}:${recipient}`;
  const last=s.notificationDeliveries.filter(d=>(d.key===key||d.key===`${key}:notification`||d.key===`${key}:live`)&&d.status==='delivered').at(-1);
  if(last&&(interval===0||Date.parse(at)-Date.parse(last.at)<interval*1000))continue;
  // Realtime and post-call detections share the notification center and dedup scope.
  s.notificationDeliveries.push({key,at,findingId:f.id,hitId:hit.id,recipient,method:'notification',status:'delivered'});sent.push(recipient);
 }
 if(sent.length)s.logs.push({id:crypto.randomUUID(),target:f.id,callId:call.id,at,actor:'system',recipients:sent,action:'预警通知',note:`${config.name}；${s.flows.find(flow=>flow.id===f.workflow?.flowId)?.name??'默认流程'}`});
 if(isNew)s.logs.push({id:crypto.randomUUID(),target:f.id,callId:call.id,at,actor:'system',recipients:[f.workflow?.flowId==='default'?supervisorId(s,call.id):s.reviews.find(r=>r.findingIds.includes(f.id)&&!['done','cancelled'].includes(r.status))?.owner??'S01'],action:'新问题待办',note:f.title});
 if(fallback)s.logs.push({id:crypto.randomUUID(),target:f.id,callId:call.id,at,actor:'system',recipients:[supervisorId(s,call.id)],action:'流程兜底通知',note:fallback});
 call.authorized=[...new Set([...call.authorized,...sent.filter(id=>people.some(p=>p.id===id&&p.role==='inspector'))])];
}
export function ingestDetection(state:State,event:DetectionEvent,now=new Date()):State {
 if(state.requests.includes(event.key))return state;
 const rule=state.rules.find(r=>r.id===event.ruleId),call=state.calls.find(c=>c.id===event.callId),batch=call?.batches.find(b=>b.id===event.batchId);
 if(!rule||!call||!batch)throw new Error('检测对象不存在');
 if(!supportsWarning(rule.indicator))return state;
 const basis=batch.rules.find(r=>r.ruleId===rule.id);if(!basis)return state;
 const condition=basis.conditions.find(c=>c.enabled!==false&&c.feature===event.feature);
 if(!condition||condition.role!=='双方'&&condition.role!==event.role||condition.stage!==event.stage&&condition.stage!=='全程')return state;
 if(!Number.isInteger(event.count)||event.count<1)throw new Error('有效检出次数须为正整数');
 if(!Number.isFinite(event.atSecond)||event.atSecond<0||event.atSecond>call.duration)throw new Error('检测发生位置超出通话范围');
 if(condition.mode==='持续时长'&&(!Number.isFinite(event.duration)||event.duration<0))throw new Error('持续时长须为有效的非负数');
 if(condition.stage==='开场'&&event.atSecond>condition.stageSeconds||condition.stage==='结束'&&(!call.endedAt||event.atSecond<call.duration-condition.stageSeconds))return state;
 if(condition.stage==='服务中'&&(!call.endedAt||(condition.middleStartSeconds??30)>=call.duration-(condition.middleEndSeconds??30)||event.atSecond<(condition.middleStartSeconds??30)||event.atSecond>call.duration-(condition.middleEndSeconds??30)))return state;
 if(condition.mode==='累计次数'&&(condition.windowSeconds>0&&event.windowSeconds!==condition.windowSeconds||event.count<condition.count)||condition.mode==='持续时长'&&event.duration<condition.duration)return state;
 if(condition.feature==='语速过快'&&!(event.speed!>condition.speed!)||condition.feature==='语速过慢'&&!(event.speed!<condition.speed!))return state;
 if(event.evidence.some(i=>!Number.isInteger(i)||!call.transcript[i]))throw new Error('证据位置无效');
 const s=ensureDetectionHistory(structuredClone(state)),at=now.toISOString(),policy=policyFor(s,rule.id),level=policy?.level??s.defaults.level;
 const hit:DetectionHit={id:`HIT-${crypto.randomUUID()}`,eventKey:event.key,batchId:batch.id,ruleId:rule.id,at,evidence:[...event.evidence],feature:event.feature,basis:structuredClone(basis),policy:{id:policy?.id,name:policy?.name??'系统默认设置',level,recipients:[...(policy?.recipients??s.defaults.recipients)],method:'notification',flowId:policy?.flowId??'default',reminderIntervalSeconds:policy?.reminderIntervalSeconds??0,inspectorIds:people.filter(p=>p.role==='inspector').map(p=>p.id)},observation:{role:event.role,stage:event.stage,count:event.count,duration:event.duration,atSecond:event.atSecond,windowSeconds:event.windowSeconds,speed:event.speed}};
 let f=s.findings.find(f=>f.callId===call.id&&(f.problemKey??f.id)===event.problemKey);
 const priorHit=f?.hits?.find(previous=>previous.ruleId===rule.id);
 if(priorHit){hit.requestedFlowId=hit.policy.flowId;hit.policy={...structuredClone(priorHit.policy),level:currentHitLevel(s,priorHit)};hit.legacy=priorHit.legacy;}
 if(f){
  const finished=problemFinished(s,f),newEvidence=!(f.hits??[]).some(previous=>sameEvidence(previous,hit));(f.hits??=[]).push(hit);f.problemKey??=event.problemKey;f.rev++;
  if(finished){if(newEvidence){f.pendingEvidence={hitIds:[...new Set([...(f.pendingEvidence?.hitIds??[]),hit.id])],at};s.logs.push({id:crypto.randomUUID(),target:f.id,callId:call.id,at,actor:'system',recipients:[supervisorId(s,call.id)],action:'新证据待确认',note:'已办结问题收到新证据，请确认是否重开'});}}
  else{f.evidence=[...new Set([...f.evidence,...event.evidence])];f.related=[...new Set([...f.related,...(f.indicator!==rule.indicator?[rule.indicator]:[])])];
   if(f.workflow&&(hit.requestedFlowId??hit.policy.flowId)!==f.workflow.flowId){f.flowConflict={hitIds:[...(f.flowConflict?.hitIds??[]),hit.id],at};s.logs.push({id:crypto.randomUUID(),target:f.id,callId:call.id,at,actor:'system',recipients:[supervisorId(s,call.id)],action:'流程要求待核查',note:'新增命中携带不同流程要求，原任务继续办理'});}
   notify(s,f,hit,now);
  }
 }else{
  const chosen=s.flows.find(flow=>flow.id===hit.policy.flowId),chosenOwner=chosen?flowOwner(s,chosen):undefined,usable=chosen?.enabled&&chosenOwner;
  const flow=usable?chosen!:s.flows.find(flow=>flow.id==='default')!,owner=usable?chosenOwner!:supervisorId(s,call.id);const fallback=usable?undefined:'指定流程失效或无接收人，回到默认流程';
  f={id:`F-${crypto.randomUUID()}`,rev:0,callId:call.id,title:event.title,indicator:rule.indicator,related:[],ruleId:rule.id,basis:structuredClone(basis),batchId:batch.id,source:'auto',severity:level,evidence:[...event.evidence],status:'candidate',conclusions:[],problemKey:event.problemKey,detectionKey:event.problemKey,hits:[hit],alertTiming:createAlertTiming(at,level),workflow:{flowId:flow.id,policyName:hit.policy.name,reason:fallback},detectionBasis:{summary:`${event.feature}：${condition.mode}，已命中资源条件。`,checks:[]}};s.findings.push(f);
  if(flow.firstNode==='inspector'){f.status='review';const time=f.alertTiming!,limit=new Date(Date.parse(time.resolutionDueAt)-(Date.parse(time.resolutionDueAt)-Date.parse(time.triggeredAt))*.2).toISOString();s.reviews.push({id:`WO-${crypto.randomUUID()}`,rev:0,callId:call.id,findingIds:[f.id],type:'candidate',scope:event.title,owner,dueAt:limit,originalDueAt:limit,status:'pending',opinions:{},history:[]});s.calls.find(c=>c.id===call.id)!.authorized=[...new Set([...call.authorized,owner])];}
  notify(s,f,hit,now,fallback,true);
 }
 s.revision++;s.requests.push(event.key);return reconcileAlerts(s,now,'检测命中');
}
export function replayDetection(state:State,callId:string,now:Date):State {
 let s=state;const call=s.calls.find(c=>c.id===callId)!,batch=call.batches.at(-1)!;
 for(const fact of state.findings.filter(f=>f.callId===callId&&hasAutomaticHit(f))){
  const priorHits=fact.hits?.length?[...new Map(fact.hits.map(h=>[`${h.ruleId}:${h.feature}`,h])).values()]:[undefined];
  for(const previous of priorHits){
   const ruleId=previous?.ruleId??fact.ruleId,basis=batch.rules.find(b=>b.ruleId===ruleId),condition=basis?.conditions.find(c=>c.enabled!==false&&(!previous||c.feature===previous.feature));if(!condition)continue;
   const data=state as State & {detectionResults?:{ruleId:string;callId:string;feature:string;count:number;duration?:number;range:number[];role:string}[]};
   const observation=data.detectionResults?.find(d=>d.callId===callId&&d.ruleId===ruleId&&d.count>0),recorded=previous?.observation;
   s=ingestDetection(s,{key:`${batch.id}:${fact.id}:${ruleId}:${condition.feature}`,problemKey:fact.problemKey??fact.id,callId,batchId:batch.id,ruleId,feature:condition.feature,role:recorded?.role??(observation?.role==='customer'?'客户':condition.role),stage:recorded?.stage??condition.stage,count:recorded?.count??observation?.count??1,duration:recorded?.duration??observation?.duration??(observation?observation.range[1]-observation.range[0]:0),atSecond:recorded?.atSecond??call.transcript[fact.evidence[0]]?.at??0,windowSeconds:recorded?.windowSeconds,speed:recorded?.speed,evidence:previous?.evidence??fact.evidence,title:fact.title},now);
  }
 }
 return s;
}
export function applyAlertCommand(state:State,cmd:Command,now:Date):State {
 if(state.requests.includes(cmd.requestId))return state;
 if(roleOf(state)!=='supervisor')throw new Error('仅主管可确认');
 const target=entity(state,cmd.id);if(!target||target.rev!==cmd.rev)throw new Error('记录已更新，请重新打开');
 if((cmd.input.note?.trim().length??0)<4)throw new Error('请填写至少 4 个字的依据');
 const s=structuredClone(state),at=now.toISOString();let label='';
 if(cmd.action==='confirm_detection'){
  const call=s.calls.find(c=>c.id===cmd.id);if(!call?.endedAt||!call.batches.length)throw new Error('通话结束后才能确认补检范围');
  call.manualDetection={batchId:call.batches.at(-1)!.id,by:s.identity,at,note:cmd.input.note!};call.rev++;label='确认人工补检完成';
 }else{
  const f=s.findings.find(f=>f.id===cmd.id);if(!f)throw new Error('问题不存在');
  if(cmd.action==='resolve_flow_conflict'){if(!f.flowConflict||f.flowConflict.resolvedAt)throw new Error('没有待核查流程');f.flowConflict={...f.flowConflict,note:cmd.input.note,resolvedAt:at};label='确认沿用当前流程';}
  else{
   if(!f.pendingEvidence||!['reopen','retain'].includes(cmd.input.value??''))throw new Error('请选择新证据处理结果');
   const decision=cmd.input.value as 'reopen'|'retain';(f.evidenceDecisions??=[]).push({at,by:s.identity,note:cmd.input.note!,outcome:decision,hitIds:f.pendingEvidence.hitIds});
   if(decision==='reopen'){f.reopenedAfterSequence=f.conclusions.at(-1)?.sequence??0;f.evidence=[...new Set([...f.evidence,...(f.hits??[]).filter(h=>f.pendingEvidence!.hitIds.includes(h.id)).flatMap(h=>h.evidence)])];f.status='candidate';f.reopenedAt=at;if(f.distribution)(f.distributionHistory??=[]).push(structuredClone(f.distribution));delete f.distribution;}
   delete f.pendingEvidence;label=decision==='reopen'?'新证据确认重开':'新证据确认维持办结';
  }
  f.rev++;
 }
 s.logs.push({id:crypto.randomUUID(),target:cmd.id,callId:'callId'in target?target.callId:cmd.id,at,actor:s.identity,recipients:[s.identity],action:label,note:cmd.input.note!});s.requests.push(cmd.requestId);s.revision++;
 return reconcileAlerts(s,now,label);
}
