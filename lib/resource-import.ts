import { resourceSchemas } from "./strategy-schema.ts";
import { parseSopRules } from "./sop-rules.ts";
export const MAX_RESOURCE_BYTES = 5 * 1024 * 1024;
export const MAX_RESOURCE_CHARS = 100000;
import { parseCsv } from "./csv.ts";
export { parseCsv } from "./csv.ts";
export function validateImportedContent(content: string): string {
  const cleaned = content.trim();
  if (!cleaned) throw new Error("文件没有可导入的内容，请按模板填写。");
  if (cleaned.includes("\uFFFD") || cleaned.includes("\0")) throw new Error("文件编码无法识别，请使用 UTF-8 文本文件。");
  if (cleaned.length > MAX_RESOURCE_CHARS) throw new Error("解析内容超过 10 万字，请拆分文件后导入。");
  return cleaned;
}
export async function readResourceFile(file: File, type: string): Promise<string> {
  if (!file.size) throw new Error("文件为空，请重新选择。");
  if (file.size > MAX_RESOURCE_BYTES) throw new Error("文件不能超过 5 MB。");
  if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("当前仅支持 CSV，请使用对应模板保存为 UTF-8 CSV。");
  const text = validateImportedContent((await file.text()).replace(/^\uFEFF/, ""));
  if(resourceSchemas[type]) { validateResourceRows(type,text,2); return text; }
  const rows=parseCsv(text);
  const bad=rows.findIndex(row=>row.length!==1 || /[\r\n]/.test(row[0]));
  if(bad>=0) throw new Error(`第 ${bad+1} 行：CSV 必须只有一列，不含表头或单元格内换行。SOP 步骤使用中文逗号「，」。`);
  const content=validateImportedContent(rows.map(row=>row[0]).join("\n"));
  if(type === "SOP") parseSopRules(content);
  return content;
}

export function serializeRows(rows:string[][]):string {return rows.map(row=>row.map(cell=>/[",\r\n]/.test(cell)?`"${cell.replaceAll('"','""')}"`:cell).join(",")).join("\n");}
export function resourceRows(kind:string,content:string):string[][] { const rows=parseCsv(content,true); if(kind==="knowledge" && rows[0]?.join("|")==="知识主题|知识内容|依据名称|生效日期|失效日期")return rows.slice(1).map(row=>row.slice(0,3)); return rows[0]?.join("|")===resourceSchemas[kind]?.fields.join("|") ? rows.slice(1) : rows; }
export function validateResourceRows(kind:string,content:string,rowOffset=kind==="hotword"?1:2):string[][] {
 const schema=resourceSchemas[kind];if(!schema)throw new Error("请选择有效业务资源类型");
 const parsed=parseCsv(validateImportedContent(content).replace(/^\uFEFF/,""),true);
 if(parsed[0]?.join("|")!==schema.fields.join("|"))throw new Error(`表头必须为：${schema.fields.join("、")}`);
 const rows=parsed.slice(1);if(!rows.length)throw new Error("请至少填写一条数据");
 const keys=new Set<string>(); const steps=new Map<string,number[]>();
 rows.forEach((row,index)=>{
  const fail=(message:string)=>{throw new Error(`第 ${index+rowOffset} 行：${message}`);};
  if(row.length!==schema.fields.length)fail(`应有 ${schema.fields.length} 列`);
  for(const col of schema.required)if(!row[col]?.trim())fail(`${schema.fields[col]}必填`);
  const key=kind==="sop"?`${row[0]}-${row[1]}`:row[0].trim();
  if(keys.has(key))fail(`${schema.fields[0]}重复或配置冲突`);keys.add(key);
  if(kind==="sop") {if(!/^[1-9]\d*$/.test(row[1]))fail("步骤序号应为正整数");if(!["是","否"].includes(row[3]))fail("是否必需只能为是/否");steps.set(row[0],[...(steps.get(row[0]) ?? []),Number(row[1])]);}
  if(kind==="voice" && !["启用","停用"].includes(row[2]))fail("启用状态只能为启用/停用");
  if(kind==="emotion" && !["愤怒","焦虑","悲伤","平静"].includes(row[0]))fail("请选择已交付的情绪标签");
  if(kind==="privacy" && row[5] && !["全部遮蔽","仅显示后四位","不脱敏"].includes(row[5]))fail("脱敏要求请选择全部遮蔽、仅显示后四位或不脱敏");
 });
 for(const [name,values] of steps)if(values.some((v,i)=>v!==i+1))throw new Error(`${name}：步骤序号应从 1 开始连续递增`);
 return rows;
}
