// Frozen pre-audit data: used only to exercise compatibility with existing saved records.
// This snapshot is never imported by the application.
import {createInitial} from '../../lib/fixtures.ts';
import { readFileSync } from 'node:fs';
const original=JSON.parse(readFileSync(new URL('../fixtures/legacy-initial.json',import.meta.url),'utf8'));
export function legacyInitial(now=new Date()){
 const delta=now.getTime()-Date.parse('2026-09-23T00:00:00Z');
 function shift(value){if(typeof value==='string'&&/^2026-\d\d-\d\dT.*Z$/.test(value))return new Date(Date.parse(value)+delta).toISOString();if(Array.isArray(value))return value.map(shift);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,shift(v)]));return value;}
 const old=shift(original), current=createInitial(now); return {...old,rules:current.rules,resources:current.resources,policies:current.policies,defaults:current.defaults,flows:current.flows,alerts:[]};
}
