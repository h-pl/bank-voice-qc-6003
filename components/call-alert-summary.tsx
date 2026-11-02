'use client';
import {indicatorRuleName} from '../lib/strategy-schema';
import {Badge,Button} from './ui';
import {CopyRecordId} from './record-id';
import {alertStatusLabel,alertResultLabel,alertSummary,problemStage} from '../lib/call-alerts';
import {canSee,person,roleNames,type State,type CallAlert} from '../lib/workflow';
const levels={high:'高',medium:'中',low:'低',none:'无待办自动风险'};
const time=(at?:string)=>at?new Date(at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
export function AlertSummary({state,alert}:{state:State;alert:CallAlert}){
 const summary=alertSummary(state,alert);
 return <div className="ui6003"><div className="alert-summary-facts"><Badge>{alertStatusLabel(alert)}</Badge><span>办结 {alert.completed} / {alert.problemIds.length}</span><span>历史最高：{levels[alert.highestLevel??alert.level]}</span>{alert.status==='closed'&&<><span>关闭前等级：{levels[alert.closingLevel??alert.level]}</span><span>{alertResultLabel(alert)} · {time(alert.closedAt)}</span></>}{Object.entries(summary.stages).filter(([,count])=>count).map(([stage,count])=><span key={stage}>{stage} {count}</span>)}{alert.status!=='closed'&&<><span>最早截止：{time(summary.earliestDeadline)}</span><span>逾期问题：{summary.overdue}</span><span>负责人：{summary.owners.map(id=>person(id)?.name??id).join('、')||'质检主管'}</span>{alert.level==='none'&&<span>{summary.waitingReason}</span>}</>}</div></div>;
}
export function AlertRecordPreview({state,alert,onOpen}:{state:State;alert:CallAlert;onOpen:(id:string)=>void}){
 return <section className="call-alert-preview ui6003"><h3><CopyRecordId id={alert.id}/></h3><AlertSummary state={state} alert={alert}/><Button onClick={()=>onOpen(alert.callId)}>查看通话</Button>{state.findings.filter(f=>alert.problemIds.includes(f.id)&&canSee(state,f.id)).map(f=><div className="call-record-card" key={f.id}><span><b>{f.title}</b><p>{problemStage(state,f)}</p></span><Button onClick={()=>onOpen(f.id)}>查看问题</Button></div>)}<h3>告警记录</h3>{alert.history.map((h,i)=><div className="alert-hit-record" key={i}><small>{time(h.at)}</small><p>{h.reason}</p></div>)}</section>;
}
export function HitHistory({state,problemId}:{state:State;problemId:string}){
 const f=state.findings.find(f=>f.id===problemId)!;
 return <section className="ui6003"><h3>检测命中与策略依据</h3>{f.hits?.map(h=><article key={h.id} className="alert-hit-record"><p>{time(h.at)} · {state.rules.find(r=>r.id===h.ruleId)?.name??h.basis?.ruleName??indicatorRuleName(f.indicator)} · {h.feature}</p><p className="subtle">证据片段 {h.evidence.map(n=>n+1).join('、')}</p><p>{h.policy.name} · 触发等级 {levels[h.policy.level]} · {h.legacy?'早期记录未保存提醒对象':h.policy.recipients.map(r=>roleNames[r]).join('、')} · {state.flows.find(f=>f.id===h.policy.flowId)?.name??h.policy.flowId}</p>{h.basis&&<details><summary>查看当时检测依据</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:12}}>{h.basis.resource.content}</pre></details>}</article>)}{f.evidenceDecisions?.map((d,i)=><p key={i}>{time(d.at)} · {person(d.by)?.name} · {d.outcome==='reopen'?'重开问题':'维持办结'}：{d.note}</p>)}</section>;
}
