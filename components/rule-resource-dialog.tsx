'use client';
import { useState, useRef, useEffect } from 'react';
import { Modal, Button, SearchField } from './ui';
import { StructuredResourceEditor, ResourceAddRow, ResourceTableColumns } from './structured-resource';
import { ResourceFileImport } from './resource-file-import';
import {SopMatrixPreview,SopMatrixScroll} from './sop-matrix';
import {groupSopRows} from '../lib/sop-matrix';
import {CopyRecordId,RecordText} from './record-id';
import {resourceRows} from '../lib/resource-import';
import {resourceSchemas} from '../lib/strategy-schema';
import { roleOf, type State, type Resource, type Rule, type Command } from '../lib/workflow';
function StructuredResourcePreview({kind,content,references,search,onSearch,grouped=false}:{kind:string;content:string;references:Rule[];search:string;onSearch:(value:string)=>void;grouped?:boolean}) {
 const schema=resourceSchemas[kind],hotword=kind==="hotword",pair=kind==="keyword" || kind==="correction";
 const list=useRef<HTMLDivElement>(null);
 const rows=(content.trim()?resourceRows(kind,content):[]).map((row,index)=>({line:index+1,word:row[0],cells:row}));
 const sopGroups=kind==="sop"?groupSopRows(rows.map(row=>row.cells)):[];
 const query=search.trim().toLowerCase();
 const sopMatches=sopGroups.filter(group=>[group.name,...group.steps.flatMap(step=>[step.content,step.required])].join(" ").toLowerCase().includes(query));
 const matches=rows.filter(row=>row.cells.join(" ").toLowerCase().includes(query));
 useEffect(()=>{list.current?.scrollTo({top:0});},[search]);
 return <section className={`hotword-preview${hotword?" hotword-resource-preview":""}${pair?" resource-read-pair":""}${kind==="correction"?" correction-resource-preview":""}${kind==="sop"?" sop-resource-preview":""}`} aria-label={`${schema.name}内容`}>
  {!grouped&&kind!=="voice"&&<p className="hotword-preview-references"><span>对应规则：</span>{references.map(rule=>rule.name).join("、")}</p>}
  {schema.note && <p className="resource-content-note">{schema.note}</p>}
  <div className="hotword-preview-toolbar">
   {grouped?<h3 className="resource-part-heading">{kind==="sop"?"SOP 规范":"业务知识"}</h3>:<SearchField name="rule-resource-search" label={hotword?"搜索热词":"搜索资源内容"} placeholder={hotword?"搜索热词…":kind==="sop"?"搜索 SOP 名称或步骤内容…":"搜索资源内容…"} value={search} onValueChange={onSearch}/>}
   <span className="hotword-preview-count" role="status">{kind==="sop"?(query?`匹配 ${sopMatches.length} / 共 ${sopGroups.length} 条 SOP`:`共 ${sopGroups.length} 条 SOP · ${rows.length} 个步骤`):query?`匹配 ${matches.length} / 共 ${rows.length} ${hotword?"个":"条"}`:`共 ${rows.length} ${hotword?"个热词":"条记录"}`}</span>
  </div>
  {kind==="sop"?<SopMatrixScroll resetKey={search}><SopMatrixPreview rows={rows.map(row=>row.cells)} search={search}/></SopMatrixScroll>:<div className={`hotword-preview-list${hotword?"":" resource-record-scroll"}`} ref={list} tabIndex={0} role="region" aria-label={hotword?"热词列表":"资源内容列表"}>
   {matches.length?<table className="resource-record-table"><ResourceTableColumns kind={kind}/>{pair && <colgroup><col style={{width:44}}/><col style={{width:kind==="keyword"?"30%":"calc((100% - 44px)/2)"}}/><col/></colgroup>}<thead><tr><th scope="col" className="resource-row-number">行号</th>{schema.fields.map(field=><th scope="col" key={field}>{hotword?"热词":field}</th>)}</tr></thead><tbody>{matches.map(row=><tr key={row.line}><th scope="row" className="resource-row-number">{row.line}</th>{schema.fields.map((field,index)=><td key={field}>{pair && <span className="resource-preview-label">{field}</span>}{kind === "voice" && index === 0 && row.cells[index] ? <CopyRecordId id={row.cells[index]}/> : <RecordText text={kind==="sop"&&index===3?(row.cells[index]==="是"?"必需":"可选"):row.cells[index] || "—"}/>}</td>)}</tr>)}</tbody></table>:<p className="hotword-preview-empty">{query?(hotword?"未找到匹配热词":"未找到匹配内容"):(hotword?"暂无热词":"暂无资源内容")}</p>}
  </div>}
 </section>;
}
export function ResourceDialog({state,resource,initialEdit=false,allowEdit=true,onSubmit,onClose}: {state:State;resource:Resource;initialEdit?:boolean;allowEdit?:boolean;onSubmit:(c:Command)=>void;onClose:()=>void}){
 const [edit,setEdit]=useState(initialEdit),[content,setContent]=useState(resource.content),[knowledge,setKnowledge]=useState(resource.knowledge??''),[sourceFile,setSourceFile]=useState(resource.sourceFile),[pending,setPending]=useState(false),[error,setError]=useState('');
 const errorRef=useRef<HTMLParagraphElement>(null),body=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
 useEffect(()=>{body.current?.scrollTo({top:0});if(edit)body.current?.querySelector<HTMLInputElement>('input:not([type=file]):not([type=checkbox])')?.focus({preventScroll:true});},[edit]);
 const [rev]=useState(resource.rev),[search,setSearch]=useState(''),[discard,setDiscard]=useState(false);
 const references=state.rules.filter(r=>r.resourceId===resource.id),manager=allowEdit&&roleOf(state)==='supervisor';
 const dirty=edit&&(content!==resource.content||knowledge!==(resource.knowledge??'')||sourceFile!==resource.sourceFile);
 const requestClose=()=>{if(dirty||pending)setDiscard(true);else onClose();};
 const professional=resource.kind==='professional',kind=professional?'sop':resource.kind;
 let voiceEntryCount=0;
 if(kind==='voice'&&content.trim()){try{voiceEntryCount=resourceRows(kind,content).length;}catch{}}
 const save=()=>{try{onSubmit({id:resource.id,rev,action:'save_resource',requestId:crypto.randomUUID(),input:{content,knowledge:professional?knowledge:undefined,sourceFile}});onClose();}catch(e){setError(e instanceof Error?e.message:'保存失败，请重试');}};
 return <Modal title={`${edit?'编辑':'查看'}${resource.name}`} titleAside={kind==='voice'?<><p className="hotword-preview-references"><span>对应规则：</span>{references.map(rule=>rule.name).join('、')}</p>{edit&&<p className="voice-resource-header-count" role="status" aria-live="polite" aria-atomic="true"><span>内容条目</span><span>{voiceEntryCount} 条</span></p>}</>:undefined} variant="action" onClose={requestClose}>
 <form className={`resource-dialog-form resource-library-form${kind==='sop'?' sop-resource-form professional-library-form':''}`} noValidate onSubmit={e=>{e.preventDefault();if(edit&&manager&&dirty&&!discard&&!pending&&rev===resource.rev)save();}}>
 <div ref={body} className={`resource-dialog-body ${edit?'resource-grid-edit-body':'hotword-preview-body'}`}>
  {!edit&&professional&&<div className="professional-resource-toolbar"><p className="hotword-preview-references"><span>对应规则：</span>{references.map(r=>r.name).join('、')}</p><SearchField name="professional-resource-search" label="搜索专业性资源" placeholder="搜索 SOP、知识内容…" value={search} onValueChange={setSearch}/></div>}
  {edit?<div className="resource-fields">
   <StructuredResourceEditor kind={kind} hideSummary={kind==='voice'} content={content} onChange={setContent} fileTools={heading=><ResourceFileImport heading={heading} sourceFile={sourceFile} type={kind} current={content} onPending={setPending} onApply={(value,name)=>{setContent(value);setSourceFile(name);}}/>}/>
   {professional&&<section className="professional-resource-section"><StructuredResourceEditor kind="knowledge" content={knowledge} onChange={setKnowledge} fileTools={heading=><ResourceFileImport heading={heading} type="knowledge" current={knowledge} onPending={setPending} onApply={setKnowledge}/>}/></section>}
  </div>:<><StructuredResourcePreview kind={kind} content={resource.content} references={references} search={search} onSearch={setSearch} grouped={professional}/>{professional&&<StructuredResourcePreview kind="knowledge" content={resource.knowledge??''} references={references} search={search} onSearch={setSearch} grouped/>}</>}
 </div><div className="resource-dialog-footer">
  {rev!==resource.rev&&<p role="alert">资源已被更新，请关闭后重新编辑。</p>}{error&&<p ref={errorRef} tabIndex={-1} role="alert" className="form-error">{error}</p>}
 {discard?<><p role="alert">资源修改尚未保存，是否放弃？</p><div><Button onClick={()=>setDiscard(false)}>继续编辑</Button><Button intent="danger" onClick={onClose}>放弃修改</Button></div></>:<div>{edit&&<><ResourceAddRow kind={kind} content={content} disabled={pending||!manager} onChange={setContent}/>{professional&&<ResourceAddRow kind="knowledge" content={knowledge} disabled={pending||!manager} onChange={setKnowledge}/>}</>}<Button onClick={onClose}>{edit?'取消':'关闭'}</Button>{edit?<Button primary type="submit" disabled={!manager||pending||rev!==resource.rev||!dirty}>保存资源</Button>:manager&&<Button primary onClick={()=>setEdit(true)}>编辑内容</Button>}</div>}
 </div></form></Modal>;
}
