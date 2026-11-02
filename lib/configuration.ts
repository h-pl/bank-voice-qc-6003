import {flowOwner} from './flow-routing.ts';
import { people, roleOf, type State, type Rule, type Command, type DetectionCondition } from './workflow.ts';
import { validateResourceRows } from './resource-import.ts';
import { reconcileAlerts } from './call-alerts.ts';
import { conditionFeatures, conditionCapabilities, ensureSystemSettings } from './configuration-schema.ts';
import { supportsWarning } from './strategy-schema.ts';
export const policyFor=(s:State,ruleId:string)=>s.policies.find(p=>p.ruleIds.includes(ruleId));
export const captureBasis=(s:State,r:Rule,at:string)=>({ruleId:r.id,ruleName:r.name,conditions:structuredClone(r.conditions),resource:structuredClone(s.resources.find(x=>x.id===r.resourceId)!),capturedAt:at});
export const captureRules=(s:State,at:string)=>s.rules.filter(r=>r.enabled).map(r=>captureBasis(s,r,at));
const must=(ok:unknown,message:string)=>{if(!ok)throw new Error(message);};
export function validateConditions(rows:DetectionCondition[],resource?:State['resources'][number]) {
 must(new Set(rows.map(c=>c.feature)).size===rows.length,'检测特征重复');
 const numeric=(v:number|undefined,min:number,max:number,label:string)=>must(Number.isInteger(v)&&v!>=min&&v!<=max,`${label}须为 ${min}–${max} 的整数`);
 for(const c of rows.filter(c=>c.enabled!==false)){
  const caps=conditionCapabilities(resource?.kind??'',c.feature);
  must(c.feature.trim()&&caps.roles.includes(c.role)&&caps.stages.includes(c.stage),'请选择能力支持的检测角色与阶段');
  if(resource)must(conditionFeatures(resource).includes(c.feature),`检测特征「${c.feature}」已失效，请重新选择或取消触发`);
  must(caps.modes.includes(c.mode),'请选择该指标支持的触发方式');
  if(c.mode==='累计次数'){numeric(c.count,1,1000,'次数');numeric(c.windowSeconds,0,3600,'统计窗口');}
  if(c.mode==='持续时长')numeric(c.duration,1,3600,'持续时长');
  if(['开场','结束'].includes(c.stage))numeric(c.stageSeconds,1,3600,'阶段范围');
  if(c.stage==='服务中'){numeric(c.middleStartSeconds??30,0,3600,'服务中开始偏移');numeric(c.middleEndSeconds??30,0,3600,'服务中结束偏移');}
  if(c.feature.startsWith('语速'))numeric(c.speed,30,600,'语速');
 }
}
export function applyConfiguration(state:State,cmd:Command,now:Date):State {
 if(state.requests.includes(cmd.requestId))return state;
 must(roleOf(state)==='supervisor','仅主管可维护配置');
 const target=[...state.rules,...state.resources,...state.policies,...(state.settings?[state.settings]:[])].find(x=>x.id===cmd.id);
 must(target && target.rev===cmd.rev,'配置已更新，请重新打开');
 const before=cmd.action==='create_policy'?{}:structuredClone(target);
 const s=ensureSystemSettings(structuredClone(state)),at=now.toISOString();
 if(cmd.action==='save_settings'){
  const settings=cmd.input.settings;must(settings,'请填写设置内容');
  must(settings!.displayFields.length&&settings!.displayFields.every(f=>['agent','group','business','duration','detection'].includes(f)),'请选择有效展示字段');
  Object.assign(s.settings!,{displayFields:[...settings!.displayFields],rev:s.settings!.rev+1,updatedAt:at});
 }else if(cmd.action==='toggle_indicator'){
  const r=s.rules.find(x=>x.id===cmd.id);must(r,'指标不存在');if(!r!.enabled){const resource=s.resources.find(x=>x.id===r!.resourceId)!;validateResourceRows(resource.kind==='professional'?'sop':resource.kind,resource.content);if(resource.kind==='professional')validateResourceRows('knowledge',resource.knowledge??'');validateConditions(r!.conditions,resource);if(supportsWarning(resource.indicator))must(r!.conditions.some(c=>c.enabled!==false),'请至少选择一项触发特征');}
 r!.enabled=!r!.enabled;r!.rev++;
 }else if(cmd.action==='save_rule_conditions'){
  const r=s.rules.find(x=>x.id===cmd.id);must(r&&supportsWarning(r.indicator),'请选择可配置业务条件的指标');
  const resource=s.resources.find(x=>x.id===r!.resourceId)!;
  must(cmd.input.content===undefined&&cmd.input.knowledge===undefined,'资源内容请在业务资源中编辑');
  const conditions=cmd.input.conditions;must(conditions,'请填写指标规则');validateConditions(conditions!,resource);
  must(conditions!.some(c=>c.enabled!==false),'请至少选择一项触发特征');
  Object.assign(r!,{conditions:structuredClone(conditions),updatedAt:at,rev:r!.rev+1});
 }else if(cmd.action==='save_resource'){
  const r=s.resources.find(x=>x.id===cmd.id);must(r,'资源不存在');
  validateResourceRows(r!.kind==='professional'?'sop':r!.kind,cmd.input.content ?? '');
  if(r!.kind==='professional')validateResourceRows('knowledge',cmd.input.knowledge ?? '');
  must(cmd.input.conditions===undefined,'检测条件请在指标规则中编辑');
  const rule=s.rules.find(rule=>rule.resourceId===r!.id);
  if(rule)validateConditions(rule.conditions,{...r!,content:cmd.input.content??''});
  Object.assign(r!,{content:cmd.input.content,knowledge:cmd.input.knowledge,sourceFile:cmd.input.sourceFile??r!.sourceFile,updatedAt:at,rev:r!.rev+1});
 }else if(cmd.action==='delete_policy'){
  const policy=s.policies.find(x=>x.id===cmd.id);must(policy,'策略不存在');
  (s.archivedPolicies??=[]).push(structuredClone(policy!));
  s.policies=s.policies.filter(x=>x.id!==cmd.id);
 }else{
  const p=cmd.input.policy;must(p,'请填写策略');
  must(p!.name.trim().length>0 && p!.name.length<=100,'策略名称须为 1–100 字');
  must(!s.policies.some(x=>x.id!==cmd.id&&x.name===p!.name.trim()),'策略名称重复');
  must(['high','medium','low'].includes(p!.level),'请选择预警等级');
  must(p!.recipients.length && new Set(p!.recipients).size===p!.recipients.length && p!.recipients.every(r=>people.some(x=>x.role===r)),'请选择通知接收人');
  must(s.flows.some(f=>f.id===p!.flowId&&f.enabled&&flowOwner(s,f)),'流程无有效接收人，请选择可执行流程');
  must(Number.isInteger(p!.reminderIntervalSeconds??0)&&(p!.reminderIntervalSeconds??0)>=0&&(p!.reminderIntervalSeconds??0)<=86400,'提醒间隔须为 0–86400 秒，0 表示每通话一次');
  must(p!.ruleIds.length && new Set(p!.ruleIds).size===p!.ruleIds.length,'请至少关联一条规则，规则不能重复');
  for(const id of p!.ruleIds){
   must(s.rules.some(r=>r.id===id&&supportsWarning(r.indicator)),'请选择可预警的有效规则');
   must(!s.policies.some(x=>x.id!==cmd.id&&x.ruleIds.includes(id)),'规则已被其他策略占用，请先解除关联');
  }
  const data={name:p!.name.trim(),level:p!.level,ruleIds:[...p!.ruleIds],recipients:[...p!.recipients],method:'notification' as const,flowId:p!.flowId,reminderIntervalSeconds:p!.reminderIntervalSeconds??0};
  if(cmd.action==='create_policy')s.policies.push({...data,id:`POL-${crypto.randomUUID()}`,rev:0,updatedAt:at});
  else {const current=s.policies.find(x=>x.id===cmd.id);must(current,'策略不存在');Object.assign(current!,data,{rev:current!.rev+1,updatedAt:at});}
 }
 s.revision++;s.requests.push(cmd.requestId);
 const after=cmd.action==='create_policy'?s.policies.at(-1):[...s.rules,...s.resources,...s.policies,...(s.settings?[s.settings]:[])].find(x=>x.id===cmd.id);
 const old=before as unknown as Record<string,unknown>,current=(after??{}) as unknown as Record<string,unknown>;
 const changes=[...new Set([...Object.keys(old),...Object.keys(current)])].filter(field=>!['rev','updatedAt','method'].includes(field)&&JSON.stringify(old[field])!==JSON.stringify(current[field])).map(field=>({field,before:old[field]??null,after:current[field]??null}));
 s.logs.push({id:crypto.randomUUID(),target:after?.id??cmd.id,actor:s.identity,at,changes,action:cmd.action==='toggle_indicator'?'切换指标状态':cmd.action==='save_resource'?'更新资源':cmd.action==='save_rule_conditions'?'更新指标规则':cmd.action==='delete_policy'?'删除策略':cmd.action==='save_settings'?'更新设置':'保存策略',note:cmd.input.note?.trim()||'配置已保存'});
 return reconcileAlerts(s,now,'预警配置调整');
}
