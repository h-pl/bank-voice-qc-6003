"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { resourceSchemas } from "../lib/strategy-schema";
import { parseSopRules } from "../lib/sop-rules";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Icon } from "./icon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

import { Disclosure } from "./disclosure";
import { readResourceFile, resourceRows, serializeRows } from "../lib/resource-import";
export function ResourceFileImport({ type, current, onApply, onPending, heading, note, sourceFile }: { sourceFile?:string; note?:string; heading?:ReactNode; type: string; current: string; onApply: (content: string, name: string) => void; onPending: (pending: boolean) => void }) {
  const schema=resourceSchemas[type];
  const [preview, setPreview] = useState<{name:string;content:string} | null>(null);
  const [loading, setLoading] = useState(false), [error,setError] = useState("");
  const [replacement, setReplacement] = useState<{ name: string; count: number; previous: string; previousFile: string } | null>(null);
  const request = useRef(0), picker = useRef<HTMLInputElement>(null);
  useEffect(() => () => { request.current++; }, []);
  const clear = () => { request.current++; setPreview(null); setLoading(false); setError(""); onPending(false); };
  const read = async (file?:File) => {
    if (!file) return;
    const token = ++request.current; setLoading(true); setPreview(null); setError(""); onPending(true);
    try { const content=await readResourceFile(file,type); if(token===request.current) {if(schema){setReplacement({name:file.name,count:resourceRows(type,content).length,previous:current,previousFile:sourceFile ?? ""});onApply(content,file.name);onPending(false);}else setPreview({name:file.name,content});} }
    catch(e) { if(token===request.current) { setError(e instanceof Error ? e.message : "解析失败，请检查文件后重试。"); onPending(false); } }
    finally { if(token===request.current) setLoading(false); }
  };
  if(schema && !schema.csv)return null;
  if(schema)return <section className="resource-file-tools" aria-label="批量更新内容">
    <div className="resource-file-toolbar"><div className="resource-file-summary">{heading}</div><div className="resource-file-actions"><a href={`data:text/csv;charset=utf-8,${encodeURIComponent("\uFEFF"+(current.trim()?serializeRows([schema.fields,...resourceRows(type,current)]):serializeRows([schema.fields])))}`} download={`${schema.name}.csv`}><Icon name="download" size={15}/>下载当前内容</a><span className="resource-upload-action"><TooltipProvider><Tooltip><TooltipTrigger asChild><Button type="button" variant="outline" disabled={loading} onClick={()=>picker.current?.click()}><Icon name="upload" size={15}/>上传替换<Icon name="info" size={14}/></Button></TooltipTrigger><TooltipContent side="top" align="end" sideOffset={6} className="resource-hint-content">UTF-8 编码的 CSV 文件，最大 5 MB。保留首行字段名：{schema.fields.join("、")}。可下载当前内容后修改并上传。{note ?? "上传将替换当前表格，保存后生效。"}</TooltipContent></Tooltip></TooltipProvider></span></div></div>

    {replacement && <p className="resource-content-note" role="status">已载入 {replacement.name} · {replacement.count} 条 · 尚未保存 <Button type="button" variant="outline" disabled={loading} onClick={()=>{onApply(replacement.previous, replacement.previousFile);setReplacement(null);}}>撤销本次替换</Button></p>}
    <Input ref={picker} className="sr-only" type="file" aria-label="上传资源文件" accept=".csv" onChange={e=>{void read(e.target.files?.[0]);e.target.value="";}}/>
    {loading && <p role="status">正在读取文件… <Button type="button" variant="outline" onClick={clear}>取消读取</Button></p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
  return <section className="resource-file-import" aria-label="文件导入与更新">
    <div className="resource-import-heading"><div><b>从文件导入内容</b><p>适用于批量更新；少量修改可直接编辑下方正文。</p></div><Button type="button" variant="outline" onClick={()=>picker.current?.click()}>选择文件</Button></div>
    <Input ref={picker} className="sr-only" type="file" aria-label="选择资源文件" accept=".csv" onChange={e=>{void read(e.target.files?.[0]);e.target.value="";}}/>
    <div className="resource-template"><a href={`/templates/${type === "SOP" ? "sop" : type === "词库" ? "lexicon" : "knowledge"}-template.csv`}>下载{type} CSV 模板</a><p>单列、无表头，每行一条内容</p></div>
    <small>UTF-8 CSV · 最大 5 MB · 预览前 5 行，校验并导入全部记录</small>
    {loading && <p role="status">正在解析文件… <Button type="button" variant="outline" onClick={clear}>取消解析</Button></p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {preview && <div className="resource-import-preview">
      <b>{preview.name}</b><p>共 {preview.content.split("\n").length} 条 · 仅预览前 5 行 · 全部记录已通过格式检查</p>
      {<ol className="csv-preview-lines">{preview.content.split("\n").slice(0,5).map((line,i)=><li key={i}>{line}</li>)}</ol>}
      <Disclosure title={`对照原内容（${current.length.toLocaleString()} 字）`}><pre>{current || "尚无内容"}</pre></Disclosure>
      <div className="resource-import-actions"><Button type="button" variant="outline" onClick={clear}>取消导入</Button><Button type="button" variant="default" disabled={!preview.content.trim()} onClick={()=>{try {if(type === "SOP") parseSopRules(preview.content);onApply(preview.content.trim(),preview.name);clear();} catch(e) {setError(e instanceof Error ? e.message : "请检查格式");}}}>确认替换内容</Button></div>
    </div>}
  </section>;
}
