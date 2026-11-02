import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseCsv, validateImportedContent, readResourceFile, validateResourceRows} from '../lib/resource-import.ts';
import {parseSopRules,readSopRules,sopEditingText} from '../lib/sop-rules.ts';
test('CSV preserves escaped quotes and rejects unclosed quotes',()=>{
 assert.deepEqual(parseCsv('"a,b","line1\nline2"\r\n"a""b",c'),[['a,b','line1\nline2'],['a"b','c']]);
 assert.throws(()=>parseCsv('"broken'),/引号/);
});
test('SOP parses named collections and reports duplicate, empty and malformed rows',()=>{
 const rules=parseSopRules('身份核验：核对身份，确认结果；\n业务办理：查询进度，反馈结果；');
 assert.equal(rules.length,2);assert.deepEqual(rules[0],{name:'身份核验',steps:['核对身份','确认结果']});
 assert.throws(()=>parseSopRules('核验：核对身份，确认结果；\n核验：核对信息，确认结果；'),/第 2 行.*重复/);
 assert.throws(()=>parseSopRules('核验：核对身份，确认结果'),/第 1 行.*分号/);
 assert.throws(()=>parseSopRules('核验：核对身份，，确认结果；'),/步骤不能为空/);
 assert.throws(()=>parseSopRules('核验：核对身份；'),/至少两个/);
 assert.throws(()=>parseSopRules('核验：核对身份，确认结果；办理：查询进度，反馈结果；'),/一行只能/);
});
test('Only single-column UTF-8 CSV is supported; template is importable',async()=>{
 for(const ext of ['xlsx','pdf','md','json','txt']) await assert.rejects(readResourceFile(new File(['abc'],`x.${ext}`),'SOP'),/仅支持 CSV/);
 await assert.rejects(readResourceFile(new File(['a'.repeat(5*1024*1024+1)],'x.csv'),'词库'),/5 MB/);
 await assert.rejects(readResourceFile(new File(['a,b'],'x.csv'),'词库'),/只有一列/);
 assert.throws(()=>validateImportedContent('\ufffd'),/编码/);
 const result=await readResourceFile(new File([fs.readFileSync('public/templates/sop-template.csv')],'sop.csv'),'SOP');
 assert.equal(parseSopRules(result).length,2);
});
test('Legacy snapshots remain unchanged while edit text becomes a named rule',()=>{
 const source='1. 核对身份\n2. 确认结果';
 assert.deepEqual(readSopRules(source,'身份核验'),[{name:'身份核验',steps:['核对身份','确认结果']}]);
 assert.equal(sopEditingText(source,'身份核验'),'身份核验：核对身份，确认结果；');
});
test('Structured imports report file lines while form validation reports content lines',async()=>{
 const content='关键词,同义词\n投诉,申诉\n投诉,抱怨';
 await assert.rejects(readResourceFile(new File([content],'keywords.csv'),'keyword'),/第 3 行：关键词重复/);
 assert.throws(()=>validateResourceRows('keyword',content,1),/第 2 行：关键词重复/);
 const quoted='意图名称,定义,正例,反例\n挂失,"核对卡片,登记挂失","卡丢了\n需要挂失",查询余额';
 const read=await readResourceFile(new File([quoted],'intent.csv'),'intent');
 assert.equal(validateResourceRows('intent',read,1)[0][2],'卡丢了\n需要挂失');
});


test('Hotword CSV round-trips BOM and quoted values; errors use file row numbers',async()=>{
 const content='\uFEFF词条\r\n慧盈存\r\n"带,逗号"\r\n';
 const imported=await readResourceFile(new File([content],'hotwords.csv'),'hotword');
 assert.deepEqual(validateResourceRows('hotword',imported,1),[['慧盈存'],['带,逗号']]);
 await assert.rejects(readResourceFile(new File(['词条\n慧盈存\n慧盈存'],'duplicate.csv'),'hotword'),/第 3 行：词条重复/);
 await assert.rejects(readResourceFile(new File(['词条\n""\n慧盈存'],'blank.csv'),'hotword'),/第 2 行：词条必填/);
 await assert.rejects(readResourceFile(new File(['错误表头\n慧盈存'],'header.csv'),'hotword'),/表头必须为：词条/);
 await assert.rejects(readResourceFile(new File(['词条\n慧盈存,额外列'],'columns.csv'),'hotword'),/第 2 行：应有 1 列/);
});
