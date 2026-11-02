"use client";
import { SopMatrixTable, SopMatrixPreview, SopMatrixScroll } from "./sop-matrix";
import { groupSopRows } from "../lib/sop-matrix";
import { CopyRecordId, RecordText } from "./record-id";
import { useRef, type ReactNode } from "react";
import { Input } from "./ui/input";
import { DatePicker } from "./ui/date-picker";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { ResourceHint } from "./resource-hint";
import { SelectField } from "./select-field";
import { Button } from "./ui";
import { Button as RowButton } from "./ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";
import { resourceSchemas } from "../lib/strategy-schema";
import { resourceRows, serializeRows } from "../lib/resource-import";
import { pasteHotwordRows, serializeHotwordRows } from "../lib/hotword-edit";
function AudioFileField({id,label,value,onChange}:{id:string;label:string;value:string;onChange:(name:string)=>void}) {
 const picker=useRef<HTMLInputElement>(null);
 const dot=value.lastIndexOf("."),hasExtension=dot>0 && dot<value.length-1;
 const stem=hasExtension?value.slice(0,dot):value,extension=hasExtension?value.slice(dot):"";
 return <div className="resource-audio-field">
  <Input ref={picker} type="file" accept="audio/*" hidden tabIndex={-1} aria-label={`${label}文件选择器`} onChange={event=>{
   const file=event.currentTarget.files?.[0];
   if(file)onChange(file.name);
   event.currentTarget.value="";
  }}/>
  <RowButton id={id} type="button" variant="outline" aria-label={`${label}，选择音频文件`} aria-describedby={`${id}-filename`} onClick={()=>picker.current?.click()}>选择</RowButton>
  <span id={`${id}-filename`} className={value?"resource-audio-name":"resource-audio-name is-empty"} title={value || undefined} aria-live="polite"><span className="resource-audio-stem">{stem || "请选择音频文件"}</span>{extension && <span className="resource-audio-extension">{extension}</span>}</span>
 </div>;
}
export function ResourceTableColumns({kind,editing=false}:{kind:string;editing?:boolean}) {
 if(kind!=="sop"&&kind!=="knowledge")return null;
 return <colgroup><col style={{width:44}}/><col style={{width:"22%"}}/>{kind==="sop"?<><col style={{width:88}}/><col/><col style={{width:128}}/></>:<><col/><col style={{width:"20%"}}/></>}{editing&&<col style={{width:64}}/>}</colgroup>;
}
export function ResourceRowsTable({kind,content,limit}:{kind:string;content:string;limit?:number}){
 const schema=resourceSchemas[kind]; const rows=resourceRows(kind,content);
 if(kind==="sop")return <SopMatrixScroll><SopMatrixPreview rows={rows} limit={limit}/></SopMatrixScroll>;
 return <div className="structured-resource-table"><Table><TableHeader><TableRow>{schema.fields.map(f=><TableHead key={f}>{f}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0,limit ?? rows.length).map((row,i)=><TableRow key={i}>{schema.fields.map((f,col)=><TableCell key={f}>{kind === "voice" && col === 0 && row[col] ? <CopyRecordId id={row[col]}/> : <RecordText text={row[col] || "—"}/>}</TableCell>)}</TableRow>)}</TableBody></Table></div>;
}
export function StructuredResourceEditor({kind,content,onChange,fileTools,note,hideSummary=false}:{hideSummary?:boolean;note?:string;kind:string;content:string;onChange:(text:string)=>void;fileTools?:(heading:ReactNode)=>ReactNode}){
 const schema=resourceSchemas[kind];let rows:string[][]=[];try{rows=content?resourceRows(kind,content):[];}catch{}
 const save=(next:string[][])=>onChange(kind==="hotword"?serializeHotwordRows(next):serializeRows([schema.fields,...next]));
 const update=(index:number,col:number,value:string)=>save(rows.map((row,i)=>i===index?schema.fields.map((_,j)=>j===col?value:row[j] ?? ""):row));
 const longFields=["定义","判定说明","知识内容","步骤内容","情绪描述","正例","反例","例外","必说要素","允许表达","例外表达","禁止行为"];
 const compactPair=kind==="keyword" || kind==="correction";
 const heading=<div className="resource-entry-count"><b>{kind==="knowledge"?"业务知识":kind==="sop"?"SOP 规范":"内容条目"}</b><span>{rows.length} 条</span></div>;

 if(kind==="sop") {
  const groups=groupSopRows(rows);
  const summary=<div className="resource-entry-count"><b>SOP 规则</b><span>{groups.length} 条 · {rows.length} 个步骤</span></div>;
  return <section className="structured-resource-editor resource-grid-editor sop-grid-editor" aria-label="SOP 规则集合字段">
   {fileTools?fileTools(summary):<div className="resource-grid-summary">{summary}{note && <p className="resource-content-note">{note}</p>}</div>}
   <SopMatrixScroll editing>
    <SopMatrixTable groups={groups} rows={rows} onChange={save}/>
    {!rows.length && <p className="hotword-preview-empty">暂无 SOP 规则，点击“添加 SOP”填写内容。</p>}
   </SopMatrixScroll>
  </section>;
 }
 const fieldHint=(col:number)=>kind==="hotword"&&col===0?"可粘贴多行内容，自动拆分为多条热词。":kind==="keyword"&&col===1?"多个同义词用中文分号「；」分隔。":kind==="etiquette"&&col===1?"多个必说要素用中文分号「；」分隔。":kind==="voice"&&col===2?"状态调整在保存资源后生效。":undefined;
 return <section className={`structured-resource-editor resource-grid-editor${compactPair?" paired-text-grid-editor":""}${kind==="hotword"?" hotword-grid-editor":""}${kind==="voice"?" voice-grid-editor":""}${kind==="correction"?" correction-grid-editor":""}`} aria-label={`${schema.name}字段`}>
 {!hideSummary&&(schema.csv && fileTools?fileTools(heading):<div className="resource-grid-summary"><div className="resource-grid-heading">{heading}</div>{note && <p className="resource-content-note">{note}</p>}</div>)}
 {hideSummary&&note&&<p className="resource-content-note">{note}</p>}
 {schema.note && <p className="resource-content-note">{schema.note}</p>}
 <div className="resource-record-scroll resource-grid-scroll" tabIndex={0} role="region" aria-label={`${schema.name}编辑表格`}>
 <table className="resource-record-table resource-edit-table"><ResourceTableColumns kind={kind} editing/>{kind==="voice" && <colgroup><col style={{width:44}}/><col style={{width:"24%"}}/><col/><col style={{width:120}}/><col style={{width:64}}/></colgroup>}{compactPair && <colgroup><col className="keyword-number-col"/><col className={kind==="keyword"?"keyword-term-col":"correction-term-col"}/><col/><col className="keyword-action-col"/></colgroup>}<thead><tr><th scope="col" className="resource-row-number">行号</th>{schema.fields.map((field,col)=><th scope="col" key={field}><span className="resource-column-label">{schema.required.includes(col) && !(kind==="voice" && col===2) && <span className="resource-required" aria-hidden="true">*</span>}{kind==="hotword"?"热词":field}{fieldHint(col) && <ResourceHint label={`${kind==="hotword"?"热词":field}填写说明`}>{fieldHint(col)}</ResourceHint>}</span></th>)}{kind!=="emotion" && <th scope="col" className="resource-row-action">操作</th>}</tr></thead><tbody>
 {rows.map((row,index)=><tr key={index}><th scope="row" className="resource-row-number">{index+1}</th>{schema.fields.map((field,col)=>{
  const options=kind==="emotion"&&col===0?["愤怒","焦虑","悲伤","平静"]:kind==="sop"&&col===3?["是","否"]:kind==="privacy"&&col===5?["全部遮蔽","仅显示后四位","不脱敏"]:undefined;
  const id=`resource-${kind}-${index}-${col}`,label=`第 ${index+1} 行 ${kind==="hotword"?"热词":field}`,required=schema.required.includes(col);
  return <td key={field}>{kind==="correction" && col===0 && <span className="correction-direction" aria-hidden="true">→</span>}{compactPair && <span className="keyword-mobile-label" aria-hidden="true">{required && <span className="resource-required">*</span>}{field}</span>}<label className="sr-only" htmlFor={id}>{label}</label>{kind==="voice"&&col===1?<AudioFileField id={id} label={label} value={row[col] ?? ""} onChange={name=>update(index,col,name)}/>:kind==="voice"&&col===2?<div className="resource-status-control"><Switch id={id} checked={row[col]==="启用"} onCheckedChange={checked=>update(index,col,checked?"启用":"停用")}/><span aria-hidden="true">{row[col]==="启用"?"启用":"停用"}</span></div>:kind==="sop"&&col===3?<div className="resource-status-control"><Switch id={id} aria-label={label} checked={row[col]==="是"} onCheckedChange={checked=>update(index,col,checked?"是":"否")}/><span aria-hidden="true">{row[col]==="是"?"必需":"可选"}</span></div>:options?<SelectField id={id} required={required} aria-required={required} value={row[col] || ""} onValueChange={value=>update(index,col,value)}><option value="">请选择</option>{options.map(v=><option key={v} value={v}>{v}</option>)}</SelectField>:(longFields.includes(field) || (kind==="keyword" && col===1))?<Textarea id={id} required={required} rows={kind==="keyword"||kind==="sop"?1:2} value={row[col] ?? ""} onChange={e=>update(index,col,e.target.value)}/>:field.endsWith("日期")?<DatePicker id={id} required={required} aria-label={label} value={row[col] ?? ""} onValueChange={value=>update(index,col,value)}/>:<Input id={id} required={required} onPaste={kind==="hotword"?event=>{
   const text=event.clipboardData.getData("text/plain");
   if(!/[\r\n]/.test(text))return;
   event.preventDefault();
   const target=event.currentTarget,result=pasteHotwordRows(rows,index,text,target.selectionStart ?? 0,target.selectionEnd ?? 0);
   if(!result)return;
   save(result.rows);
   requestAnimationFrame(()=>{const input=document.getElementById(`resource-hotword-${result.lastIndex}-0`) as HTMLInputElement | null;input?.focus();input?.setSelectionRange(result.caret,result.caret);});
  }:undefined} type={field==="步骤序号"?"number":"text"} min={field==="步骤序号"?1:undefined} value={row[col] ?? ""} onChange={e=>update(index,col,e.target.value)}/>}</td>;
 })}{kind!=="emotion" && <td className="resource-row-action"><RowButton type="button" variant="ghost" aria-label={`删除第 ${index+1} 行`} onClick={()=>save(rows.filter((_,i)=>i!==index))}>删除</RowButton></td>}</tr>)}
 </tbody></table>
 {!rows.length && <p className="hotword-preview-empty">暂无记录，点击“添加一条”填写内容。</p>}
 </div>
 </section>;
}

export function ResourceAddRow({kind,content,onChange,disabled=false}:{kind:string;content:string;onChange:(content:string)=>void;disabled?:boolean}) {
 const schema=resourceSchemas[kind];
 if(!schema || kind==="emotion")return null;
 return <span className="resource-add-row"><Button icon="plus" disabled={disabled} onClick={()=>{
  let rows:string[][]=[];try{rows=content?resourceRows(kind,content):[];}catch{}
  const next=[...rows,kind==="sop"?["","1","","是"]:schema.fields.map((_,col)=>kind==="voice" && col===2?"启用":"")];
  onChange(kind==="hotword"?serializeHotwordRows(next):serializeRows([schema.fields,...next]));
  requestAnimationFrame(()=>document.getElementById(`resource-${kind}-${rows.length}-0`)?.focus());
 }}>{kind==="sop"?"添加 SOP":kind==="knowledge"?"添加知识":"添加一条"}</Button></span>;
}
