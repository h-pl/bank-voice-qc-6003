export type SopRule = { name: string; steps: string[] };
export function parseSopRules(content: string): SopRule[] {
  const rules: SopRule[] = [], names = new Set<string>();
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  for (let i=0; i<lines.length; i++) {
    const line=lines[i].trim(); if(!line) continue;
    const fail=(message:string):never=>{throw new Error(`第 ${i+1} 行：${message}`);};
    if (!line.endsWith("；")) fail("请以中文分号「；」结尾。");
    const body=line.slice(0,-1), colon=body.indexOf("：");
    if(colon<1) fail("请填写 SOP 名称，并用中文冒号「：」分隔名称和步骤。");
    if(body.includes("；") || body.includes(";")) fail("一行只能包含一条 SOP 规则。");
    const name=body.slice(0,colon).trim();
    if(!name || /[，,]/.test(name)) fail("SOP 名称不能为空或包含分隔逗号。");
    if(names.has(name)) fail(`SOP 名称「${name}」重复。`);
    const steps=body.slice(colon+1).split("，").map(x=>x.trim());
    if(steps.length<2) fail("每条 SOP 至少两个步骤，使用中文逗号「，」分隔。");
    if(steps.some(x=>!x)) fail("步骤不能为空，请检查连续逗号或末尾多余逗号。");
    if(steps.some(x=>/[,:：]/.test(x))) fail("步骤正文请使用顿号或句号，勿混用分隔逗号或冒号。");
    names.add(name);rules.push({name,steps});
  }
  if(!rules.length) throw new Error("请至少填写一条 SOP 规则。");
  return rules;
}
// Legacy published snapshots remain untouched; only render their existing ordered list as one named rule.
export function readSopRules(content:string,name:string):SopRule[] {
  try { return parseSopRules(content); } catch {
    const lines=content.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(lines.length>=2 && lines.every(x=>/^\d+[.、．)）]/.test(x))) return [{name,steps:lines.map(x=>x.replace(/^\d+[.、．)）]\s*/,""))}];
    return [];
  }
}
export function sopEditingText(content:string,name:string) {
  const rules=readSopRules(content,name);
  return rules.length ? rules.map(r=>`${r.name}：${r.steps.join("，")}；`).join("\n") : content;
}
