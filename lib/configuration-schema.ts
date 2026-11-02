import { people, type DetectionCondition, type Resource, type State, type DetectionBasis } from './workflow.ts';
import { indicatorRuleName, resourceSchemas } from './strategy-schema.ts';
import { resourceRows, serializeRows } from './resource-import.ts';

export function conditionFeatures(resource:Resource):string[] {
 if (['intent','emotion'].includes(resource.kind)) {
  try { return resourceRows(resource.kind,resource.content).map(row=>row[0]).filter(Boolean); } catch { return []; }
 }
 return resource.kind==='voice'?['身份不匹配','未注册声纹','无法确认身份']:resource.kind==='expression'?['静默','抢话','语速过快','语速过慢']:resource.kind==='etiquette'?['规范缺失']:['hotword','correction'].includes(resource.kind)?[]:['指标命中'];
}
export function conditionCapabilities(kind:string,feature:string) {
 return {roles:['voice','etiquette'].includes(kind)?['坐席']:['坐席','客户','双方'],stages:['全程','开场','服务中','结束'],modes:feature==='抢话'||['keyword','intent','banned','voice','etiquette','professional','privacy','attitude'].includes(kind)?['单次命中','累计次数']:['单次命中','累计次数','持续时长']};
}
export function newCondition(feature:string):DetectionCondition {return {feature,enabled:true,role:'坐席',stage:'全程',mode:'单次命中',count:1,duration:15,windowSeconds:0,stageSeconds:30,middleStartSeconds:30,middleEndSeconds:30,...(feature.startsWith('语速')?{speed:feature==='语速过快'?220:100}:{})};}
// Upgrade stored configuration without changing captured detection values.
export function migrateRuleConditions(s:State) {
 type LegacyResource = Resource & {conditions?:DetectionCondition[]};
 for(const rule of s.rules){
  const resource=s.resources.find(r=>r.id===rule.resourceId) as LegacyResource|undefined;
  rule.conditions??=structuredClone(resource?.conditions??[]);
 }
 for(const resource of s.resources)delete (resource as LegacyResource).conditions;
 const migrateBasis=(basis?:DetectionBasis)=>{
  if(!basis)return;
  const resource=basis.resource as LegacyResource;
  basis.conditions??=structuredClone(resource.conditions??[]);
  delete resource.conditions;
 };
 for(const call of s.calls)for(const batch of call.batches)for(const basis of batch.rules??[])migrateBasis(basis);
 for(const finding of s.findings){migrateBasis(finding.basis);for(const hit of finding.hits??[])migrateBasis(hit.basis);}
 return s;
}
export function ensureSystemSettings(s:State) {
 migrateRuleConditions(s);
 for(const resource of s.resources)if(resource.kind==='professional'&&resource.knowledge)resource.knowledge=serializeRows([resourceSchemas.knowledge.fields,...resourceRows('knowledge',resource.knowledge)]);
 s.settings??={id:'PLATFORM-SETTINGS',rev:0,settingsType:'platform',displayFields:['agent','group','business','duration','detection'],updatedAt:s.calls[0]?.startedAt??new Date(0).toISOString()};
 // Retain display preferences while removing obsolete detection-scope settings.
 const settings=s.settings;
 s.settings={id:settings.id,rev:settings.rev,settingsType:'platform',displayFields:[...settings.displayFields],updatedAt:settings.updatedAt};
 // Remove obsolete group settings; retain resolved recipients on historical hits.
 const legacy=s as State & {inspectorGroups?:{id:string;memberIds:string[]}[]};
 for(const finding of s.findings)for(const hit of finding.hits??[]){
  const policy=hit.policy as typeof hit.policy & {inspectorGroupIds?:string[]};
  if(policy.inspectorIds===undefined&&policy.inspectorGroupIds?.length){
   policy.inspectorIds=legacy.inspectorGroups?.filter(g=>policy.inspectorGroupIds?.includes(g.id)).flatMap(g=>g.memberIds)??people.filter(p=>p.role==='inspector').map(p=>p.id);
  }
  delete policy.inspectorGroupIds;
 }
 delete legacy.inspectorGroups;
 for(const p of s.policies){p.reminderIntervalSeconds??=0;delete (p as typeof p & {inspectorGroupIds?:string[]}).inspectorGroupIds;}
 for(const rule of s.rules){delete rule.businesses;rule.name=indicatorRuleName(rule.indicator);}
 for(const flow of s.flows){if(flow.id==='default'&&flow.name==='默认质检流程')flow.name='优先质检主管';flow.returnPath??='主管退回 → 原质检员继续核查';flow.endPath??='误报归档，或分发后按申诉 / 整改结果办结';}
 return s;
}
