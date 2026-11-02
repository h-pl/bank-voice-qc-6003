import {createPrototypeState} from '../../../lib/prototype-seeds.ts';
import {apply,entity} from '../../../lib/workflow.ts';
import {captureRules,policyFor,validateConditions} from '../../../lib/configuration.ts';
import {ingestDetection} from '../../../lib/call-alerts.ts';
import {report} from '../../../lib/reports.ts';
import {callTriggers} from '../../../lib/call-triggers.ts';
const now=new Date('2026-10-31T08:00:00Z');
const run=(s,id,action,input={})=>apply(s,{id,rev:entity(s,id).rev,action,requestId:crypto.randomUUID(),input},now);
function fresh(){const s=createPrototypeState(now);s.calls=[s.calls[0]];const c=s.calls[0];c.endedAt=now.toISOString();c.batches=[{id:'B-audit',startedAt:now.toISOString(),rules:captureRules(s,now.toISOString()),checks:[{name:'检测',state:'running'}]}];for(const k of ['findings','reviews','appeals','remedies','supplements','alerts','logs'])s[k]=[];return s;}
function event(s,ruleId='R-COM-012',problemKey='same-business-problem'){const c=s.calls[0],condition=c.batches.at(-1).rules.find(r=>r.ruleId===ruleId).resource.conditions[0];return {key:crypto.randomUUID(),problemKey,callId:c.id,batchId:c.batches.at(-1).id,ruleId,feature:condition.feature,role:condition.role,stage:condition.stage,count:10,duration:30,atSecond:20,evidence:[0],title:'审计复现问题'};}
const results=[];
{
 let s=fresh();s=ingestDetection(s,event(s),now);s=ingestDetection(s,event(s,'R-BAN-001'),now);
 results.push({case:'同一业务问题跨规则命中',expectedProblems:1,actualProblems:s.findings.length,alerts:s.alerts.length});
}
{
 const s=createPrototypeState(now),m=report(s,{start:'',end:'',business:'',group:'',agent:''},now),get=k=>Number(m.find(x=>x.key===k).value);
 results.push({case:'风险分布应等于未关闭告警',open:get('alerts-open'),closed:get('alerts-closed'),actualDistribution:['high','medium','low','none'].reduce((n,k)=>n+get('alert-'+k),0)});
}
{
 let s=fresh();delete s.calls[0].endedAt;const basis=s.calls[0].batches[0].rules.find(r=>r.ruleId==='R-COM-012');Object.assign(basis.resource.conditions[0],{stage:'服务中',middleStartSeconds:0,middleEndSeconds:30});
 s=ingestDetection(s,{...event(s),atSecond:10},now);
 results.push({case:'依赖终点的服务中范围应在结束后判断',expectedProblems:0,actualProblems:s.findings.length,callEnded:!!s.calls[0].endedAt});
}
{
 const s=fresh(),r=s.resources.find(r=>r.kind==='intent');const prior=r.conditions.map(c=>c.feature);const content=r.content.replaceAll('查询转账进度','新的业务意图');
 let saved=false,message;try{const next=run(s,r.id,'save_resource',{content,conditions:r.conditions});saved=true;message=next.resources.find(x=>x.id===r.id).conditions.map(c=>c.feature);}catch(e){message=e.message;}
 results.push({case:'删除或改名后失效的意图触发项应阻止保存',originalFeatures:prior,saveAccepted:saved,remainingFeatures:message});
}
{
 const s=fresh(),r=s.resources.find(r=>r.kind==='privacy'),conditions=structuredClone(r.conditions);conditions[0].mode='单次命中';conditions[0].count=0;
 let error;try{validateConditions(conditions);}catch(e){error=e.message;}
 results.push({case:'隐藏的累计次数字段不应阻塞单次条件',mode:conditions[0].mode,rejectedByHiddenField:!!error,error});
}
{
 let s=fresh();s=ingestDetection(s,event(s),now);const f=s.findings[0],captured=structuredClone(f);const p=policyFor(s,f.ruleId);s=run(s,p.id,'save_policy',{policy:{...p,level:'low'}});
 results.push({case:'策略降级后保留命中时等级与策略事实',before:captured.severity,after:s.findings[0].severity,basisKeys:Object.keys(s.findings[0].basis),workflow:s.findings[0].workflow,alertKeys:Object.keys(s.alerts[0])});
}
{
 let s=fresh();s=ingestDetection(s,event(s),now);s.calls[0].batches[0].checks[0].state='success';s=run(s,s.findings[0].id,'dismiss',{value:'false_positive',note:'已核对完整上下文',evidence:[0]});s=ingestDetection(s,{...event(s),evidence:[1]},now);
 results.push({case:'已办结问题新证据应产生主管确认入口',status:s.alerts[0].status,evidence:s.findings[0].evidence,latestLog:s.logs.at(-1)?.action,workflow:s.findings[0].workflow});
}
{
 let s=fresh();s=ingestDetection(s,event(s),now);s.calls[0].batches[0].checks[0].state='success';s=run(s,s.calls[0].id,'start_detection');s=run(s,s.calls[0].id,'finish_detection',{value:'success'});
 results.push({case:'重检再次命中应显示最新批次命中记录',problems:s.findings.length,ruleCount:callTriggers(s.calls[0],s.findings).ruleCount,indicatorCount:callTriggers(s.calls[0],s.findings).indicatorCount,latestBatch:s.calls[0].batches.at(-1).id,findingBatch:s.findings[0].batchId});
}
{
 let s=createPrototypeState(now);const review=s.reviews.find(r=>r.type==='appeal'&&!['done','cancelled'].includes(r.status)&&r.findingIds.length&&s.findings.find(f=>f.id===r.findingIds[0])?.source==='auto');
 const finding=s.findings.find(f=>f.id===review.findingIds[0]),policy=policyFor(s,finding.ruleId),before=review.dueAt;
 s=run(s,policy.id,'save_policy',{policy:{...policy,level:'low'}});
 results.push({case:'预警降级不应改写申诉核查期限',review:review.id,type:review.type,before,after:s.reviews.find(r=>r.id===review.id).dueAt});
}
{
 let s=fresh();const p=policyFor(s,'R-COM-012');s=run(s,p.id,'save_policy',{policy:{...p,recipients:['agent'],flowId:'special-review'}});
 s.flows.find(f=>f.id==='special-review').owner='missing';s=ingestDetection(s,event(s),now);
 results.push({case:'特殊流程失效回默认时应通知主管',flow:s.findings[0].workflow,notificationRecipients:s.logs.filter(x=>x.action==='预警通知').at(-1)?.recipients});
}
console.log(JSON.stringify({at:now.toISOString(),results},null,2));
