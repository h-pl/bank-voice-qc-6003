// 仅修改独立内存样本，不访问浏览器存储，也不写应用数据。
// 从项目根目录执行：node --experimental-strip-types docs/6003/audit/配置逻辑复现-20261102.mjs
import {createPrototypeState} from '../../../lib/prototype-seeds.ts';
import {apply,entity} from '../../../lib/workflow.ts';
import {captureRules,policyFor} from '../../../lib/configuration.ts';
import {conditionFeatures} from '../../../lib/configuration-schema.ts';
import {ingestDetection} from '../../../lib/call-alerts.ts';

const now=new Date('2026-11-02T04:10:00Z');
const run=(s,id,action,input)=>apply(s,{id,rev:entity(s,id).rev,action,input,requestId:crypto.randomUUID()},now);
const results=[];

let s=createPrototypeState(now);
s.calls=[s.calls[0]];
const call=s.calls[0];
call.duration=120;
call.endedAt=now.toISOString();
call.batches=[{id:'B-audit',startedAt:now.toISOString(),rules:captureRules(s,now.toISOString()),checks:[{name:'检测',state:'success'}]}];
for(const key of ['findings','reviews','appeals','remedies','supplements','alerts','logs','notificationDeliveries'])s[key]=[];
const rule=s.rules.find(r=>r.resourceId===s.resources.find(x=>x.kind==='privacy').id);
const condition=rule.conditions[0];
s=ingestDetection(s,{key:'audit-hit',problemKey:'audit-problem',callId:call.id,batchId:'B-audit',ruleId:rule.id,feature:condition.feature,role:condition.role,stage:'全程',count:1,duration:0,atSecond:20,evidence:[0],title:'策略关联切换复核'},now);
const before={level:s.alerts[0].level,policy:s.findings[0].hits[0].policy.name};
const original=policyFor(s,rule.id);
s=run(s,original.id,'save_policy',{policy:{...original,ruleIds:original.ruleIds.filter(id=>id!==rule.id)}});
const detached=s.alerts[0].level;
s=run(s,s.rules[0].id,'create_policy',{policy:{name:'仅用于内存复核的新策略',ruleIds:[rule.id],level:'low',recipients:['supervisor'],flowId:'default',reminderIntervalSeconds:0}});
results.push({id:'D02',case:'在办问题改绑',before,afterDetach:detached,afterRebind:s.alerts[0].level,originalHitPolicy:s.findings[0].hits[0].policy.name,problemCount:s.findings.length,hitCount:s.findings[0].hits.length});

s=createPrototypeState(now);
const resource=s.resources.find(r=>r.kind==='expression');
s=run(s,resource.id,'save_resource',{content:'表达特征,说明\n静默,仅保留静默'});
const current=entity(s,resource.id),expressionRule=s.rules.find(x=>x.resourceId===resource.id);
results.push({id:'D03',case:'表达资源删除特征',content:current.content,availableFeatures:conditionFeatures(current),enabledConditions:expressionRule.conditions.filter(c=>c.enabled!==false).map(c=>c.feature)});

s=createPrototypeState(now);
const intent=s.resources.find(r=>r.kind==='intent');
try{
  run(s,intent.id,'save_resource',{content:intent.content.replaceAll('查询转账进度','查询汇款状态')});
  results.push({case:'引用中的意图改名',result:'保存成功'});
}catch(error){
  results.push({case:'引用中的意图改名',result:'保存被拦截',error:error.message});
}
console.log(JSON.stringify({date:'2026-11-02',environment:'isolated in-memory prototype state',results},null,2));
