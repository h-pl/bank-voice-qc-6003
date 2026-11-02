import test from 'node:test';
import assert from 'node:assert/strict';
import { pasteHotwordRows, serializeHotwordRows } from '../lib/hotword-edit.ts';
import { resourceRows, validateResourceRows } from '../lib/resource-import.ts';

test('Multiline paste replaces the selection without losing surrounding rows or text',()=>{
 const rows=[['原词'],['前待替换后'],['后续词']];
 const before=structuredClone(rows);
 const result=pasteHotwordRows(rows,1,'  新词一\r\n\r\n新词二\n',1,4);
 assert.deepEqual(result,{rows:[['原词'],['前新词一'],['新词二后'],['后续词']],lastIndex:2,caret:3});
 assert.deepEqual(rows,before);
 assert.equal(pasteHotwordRows(rows,1,' \n \r\n',0,0),null);
});

test('Explicit empty table rows survive serialization and fail visible-row validation',()=>{
 const rows=[['正常热词'],['']];
 const content=serializeHotwordRows(rows);
 assert.deepEqual(resourceRows('hotword',content.trim()),rows);
 assert.throws(()=>validateResourceRows('hotword',content.trim(),1),/第 2 行：词条必填/);
 assert.throws(()=>validateResourceRows('hotword',serializeHotwordRows([['同词'],['同词']]),1),/第 2 行：词条重复/);
 const quoted=[['带,逗号'],['带"引号']];
 assert.deepEqual(validateResourceRows('hotword',serializeHotwordRows(quoted),1),quoted);
});
