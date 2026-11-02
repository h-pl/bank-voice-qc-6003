import { parseSopRules, type SopRule } from "../lib/sop-rules";
export function SopPreview({content}:{content:string}) {
  let rules:SopRule[] = [], error="";
  if (!content.trim()) return null;
  try { rules=parseSopRules(content); } catch(e) {error=e instanceof Error ? e.message : "请检查 SOP 格式";}
  if(error) return <p className="form-error" role="alert">{error}</p>;
  return <div className="sop-preview" aria-label="SOP 规则预览"><p className="subtle">共 {rules.length} 条 SOP 规则</p><ul>{rules.map((rule,index)=>{const text=`${rule.name}：${rule.steps.join("，")}；`;return <li key={index} title={text}>{text}</li>;})}</ul></div>;
}
