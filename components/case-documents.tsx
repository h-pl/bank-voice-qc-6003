"use client";
import { indicatorRuleName } from "../lib/strategy-schema";
import { RecordReference } from "./record-id";
import { useState, type ReactNode } from "react";
import { person, latest, verdictNames, type Entity, type Finding } from "../lib/workflow";
import { Badge, Button, Modal } from "./ui";
import { Button as RowButton } from "./ui/button";
import { Icon } from "./icon";

export function nextResponsibility(item:Entity):string {
  if ("pause" in item && item.pause) return "申诉裁定后，按裁定结果恢复整改或终止本案。";
  if ("status" in item && ["done","terminated","cancelled","withdrawn","rejected","closed"].includes(item.status)) return "本轮已结束，结论与材料保留供追溯。";
  if ("standardSequence" in item) {
    if(item.status === "response") return "质检员核对主管意见：不赞同则向主管补充核验说明；赞同则补充整改要求并退回坐席。";
    if(!item.inspector) return "坐席可先整改并提交资料；主管并行指定质检员，核验前必须完成指派。";
    if (["pending","executing"].includes(item.status)) return `坐席提交材料 → ${person(item.inspector)?.name ?? "指定质检员"}独立验收 → 主管确认。`;
    if (item.status==="verification") return "质检员提交验收意见 → 主管确认；材料不足则退回补充。";
    return item.supervisorReason==="approve" ? "主管确认通过 → 整改结案。" : item.supervisorReason==="return" ? `主管退回 → 质检员核对意见，再决定向主管说明或让坐席补充。` : "主管调整要求 → 按新标准继续验收。";
  }
  if ("findingIds" in item) {
    if(item.evidenceRequest) return "主管安排补证 → 原质检员继续核查。";
    if(item.type === "spotcheck" && !item.findingIds.length) return item.status === "supervisor" ? "主管确认未发现问题后完成抽检；不认可则退回原质检员核查。" : "按抽检范围核查：有发现登记问题，无发现提交范围核验说明，由主管确认。";
    if(item.appealId) return "质检员提交核查意见 → 主管完成申诉裁定。";
    return item.status==="supervisor" ? "认可核实结果：误报归档，非误报分发给坐席；不认可：退回原质检员重新核实。" : "质检员提交逐项意见 → 主管确认正式结论。";
  }
  if ("conclusionSequence" in item) return item.status==="supplement" ? "坐席补证 → 质检员核对接收 → 返回原办理环节。" : item.status==="submitted" ? "主管指派质检员 → 核查并提交意见 → 主管确认 → 结果送达坐席。" : "核查意见交主管裁定 → 结果送达坐席，同步关联整改。";
  if ("executor" in item) return "执行人补齐材料 → 指定接收人核对 → 返回原办理环节。";
  if ("conclusions" in item) return latest(item)?.value === "false_positive" ? "误报已归档，保留原因与证据；主管可记录规则优化反馈。" : latest(item) ? "坐席查看处理结果与要求：接受进入整改，不接受进入申诉。" : "主管初审：误报归档；需核实交质检员；无需核实直接提醒并分发。";
  return "检测完成后查看候选问题，必要时发起人工抽查。";
}

const materialTime=(at?:string)=>at ? new Date(at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}) : '时间未记录';
export function DocumentRow({title,summary,status,onView}:{title:string;summary:string;status:string;onView?:()=>void}) {
  return <div className="case-document compact-document-row"><span className="case-document-icon"><Icon name="file"/></span><span className="document-row-copy"><b>{title}</b><small>{summary}</small></span><Badge tone={onView ? 'neutral' : 'warning'}>{status}</Badge>{onView && <RowButton variant="link" className="document-view-button" aria-label={`查看${title}`} onClick={onView}>查看</RowButton>}</div>;
}

type DocumentEntry={id:string;title:string;summary:string;status:string;ready:boolean;content:ReactNode};
export function CaseDocuments({item,primary,onOpen,inline=false}: {item:Entity;primary?:Finding;onOpen:(id:string)=>void;inline?:boolean}) {
  const [selected,setSelected]=useState<string>();
  const entries:DocumentEntry[]=[];
  const conclusion=primary ? "conclusionSequence" in item ? primary.conclusions.find(c=>c.sequence===item.conclusionSequence) : latest(primary) : undefined;
  if(primary && conclusion && !("findingIds" in item)) entries.push({id:"conclusion",title:"原始问题与结论依据",summary:`${person(conclusion.by)?.name ?? "处理人未记录"} · ${materialTime(conclusion.at)}`,status:verdictNames[conclusion.value],ready:!!conclusion,content:<><h3>{primary.title}</h3><p className="subtle">{verdictNames[conclusion.value]} · {person(conclusion.by)?.name ?? "处理人未记录"} · {materialTime(conclusion.at)}</p><p>{conclusion?.note ?? "该候选尚未形成正式人工结论。"}</p><dl><dt>规则依据</dt><dd>{indicatorRuleName(primary.indicator)}</dd></dl></>});
  if("conclusionSequence" in item && !("standardSequence" in item) && (item.sameReviewerReason || item.outcome)) entries.push({id:"appeal",title:"申诉核查与裁定",summary:item.outcome ? "查看裁定结果与核查说明" : "查看同人核查说明",status:item.outcome ? "已裁定" : "已提交",ready:true,content:<><p>针对原成立结论提出申诉</p>{item.sameReviewerReason && <p>同人核查说明：{item.sameReviewerReason}</p>}{item.outcome && <p>裁定：{{maintain:"维持原结论",false_positive:"改判误报",insufficient:"证据不足",adjust:"调整成立范围"}[item.outcome]}</p>}</>});
  if("standardSequence" in item) {
    entries.push({id:"standard",title:"整改交接要求",summary:`第 ${item.round} 轮 · ${item.sampleCount} 通样例`,status:"完成要求",ready:true,content:<><h3>整改目标</h3><p>{item.goal}</p><h3>完成标准</h3><p>{item.standard}</p><p>观察要求：{item.observation} · {item.sampleCount} 通样例</p></>});
    entries.push({id:"materials",title:"整改完成材料",summary:item.materials.length ? `最近提交 ${materialTime(item.materials.at(-1)?.at)}` : "尚未提交",status:item.materials.length ? `${item.materials.length} 份已提交` : "待补充",ready:!!item.materials.length,content:<>{item.materials.map((m,index)=><section key={index}><h3>材料 {index+1}</h3><p>{m.text}</p>{m.attachment && <p>附件记录：{m.attachment}</p>}<div className="sample-links">{m.samples.map(id=><RecordReference key={id} id={id} label="查看样例" onOpen={()=>{setSelected(undefined);onOpen(id);}}/>)}</div></section>)}{!item.materials.length && <p>本轮尚未提交材料，提交后会保留完成说明和样例记录。</p>}</>});
    entries.push({id:"acceptance",title:"独立验收意见",summary:item.acceptance ? `${person(item.inspector)?.name ?? "验收人未记录"} · 第 ${item.acceptance.round} 轮` : item.acceptanceDraft ? "已有草稿，尚未提交" : "尚未提交验收意见",status:item.acceptance ? {pass:"通过",fail:"不通过",insufficient:"材料不足"}[item.acceptance.result] : "待验收",ready:!!item.acceptance,content:<><p>{item.acceptance?.note ?? "尚未形成正式验收意见。"}</p><p>第 {item.acceptance?.round ?? item.round} 轮</p><p>验收人：{person(item.inspector)?.name}</p></>});
  }
  const document=entries.find(x=>x.id===selected);
  if(inline)return <div className="inline-document-details">{entries.filter(entry=>entry.ready).map(entry=><section className="inline-document-detail" key={entry.id}><header><h4>{entry.title}</h4><Badge>{entry.status}</Badge></header><div className="document-preview">{entry.content}</div></section>)}</div>;
  return <>{entries.map(entry=><DocumentRow key={entry.id} title={entry.title} summary={entry.summary} status={entry.status} onView={entry.ready ? ()=>setSelected(entry.id) : undefined}/>)}{document && <Modal title={document.title} description={`${item.id} · ${document.status}`} onClose={()=>setSelected(undefined)} footer={<Button onClick={()=>setSelected(undefined)}>关闭</Button>}><div className="document-preview">{document.content}</div></Modal>}</>;

}
