'use client';
import {useState,useRef,useEffect,useId} from 'react';
import {Button,Modal} from './ui';
import {Input} from './ui/input';
import {indicatorName} from '../lib/strategy-schema';
import {DetectionConditionsEditor} from './detection-conditions-editor';
import {VoiceConditionsEditor} from './voice-conditions-editor';
import {newCondition} from '../lib/configuration-schema';
import {roleOf,type State,type Rule,type Command} from '../lib/workflow';

export function IndicatorRuleDialog({state,rule,onSubmit,onClose}:{state:State;rule:Rule;onSubmit:(command:Command)=>void;onClose:()=>void}){
 const resource=state.resources.find(r=>r.id===rule.resourceId)!;
 const [initial]=useState(()=>({conditions:structuredClone(rule.conditions),rev:rule.rev}));
 const [conditions,setConditions]=useState(()=>structuredClone(initial.conditions)),[note,setNote]=useState(''),[error,setError]=useState(''),[discard,setDiscard]=useState(false);
 const [attempted,setAttempted]=useState(false),[saving,setSaving]=useState(false);
 const formRef=useRef<HTMLFormElement>(null),savingRef=useRef(false);
 const voice=resource.kind==='voice';
 const errorId=useId(),errorRef=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
 const dirty=JSON.stringify(conditions)!==JSON.stringify(initial.conditions),manager=roleOf(state)==='supervisor',stale=rule.rev!==initial.rev;
 const close=()=>{if(savingRef.current)return;if(dirty||note)setDiscard(true);else onClose();};
 const save=async()=>{
  if(savingRef.current)return;
  setError('');setAttempted(true);
  if(voice){
   if(!conditions.some(c=>c.enabled!==false)){formRef.current?.querySelector<HTMLButtonElement>('[role="checkbox"]')?.focus();return;}
   const invalid=formRef.current?.querySelector<HTMLInputElement>('input:invalid');
   if(invalid){invalid.focus();return;}
  }
  // Hidden or disabled blank drafts keep their last saved numeric value.
  const submitted=voice?conditions.map(c=>{
   const fallback={...newCondition(c.feature),...initial.conditions.find(row=>row.feature===c.feature)};
   const next={...c};
   for(const key of ['count','windowSeconds','stageSeconds','middleStartSeconds','middleEndSeconds'] as const){
    if(next[key]!==undefined&&!Number.isFinite(next[key]))next[key]=fallback[key]!;
   }
   return next;
  }):conditions;
  savingRef.current=true;setSaving(true);
  try{await onSubmit({id:rule.id,rev:initial.rev,action:'save_rule_conditions',requestId:crypto.randomUUID(),input:{conditions:submitted,note:note.trim()||`更新${rule.name}的业务触发条件`}});onClose();}
  catch(e){setError((e as Error).message);}
  finally{savingRef.current=false;setSaving(false);}
 };
 return <Modal title={`编辑${rule.name}`} variant="action" onClose={close}>
  <form ref={formRef} className={`resource-dialog-form resource6003-form indicator-rule-editor ui6003${voice?' voice-rule-editor':''}`} noValidate aria-busy={saving} onSubmit={e=>{e.preventDefault();if(manager&&!stale&&!discard&&dirty)void save();}}>
   <div className="resource-dialog-body resource6003-body"><dl className="rule-detail-fields rule-editor-context">{voice?<><div><dt>关联资源</dt><dd>{resource.name}</dd></div><div><dt>检测角色</dt><dd>坐席</dd></div></>:<><div><dt>对应指标</dt><dd>{indicatorName(rule.indicator)}</dd></div><div><dt>对应资源</dt><dd>{resource.name}</dd></div></>}</dl>
    <fieldset className="indicator-rule-fields" disabled={!manager||stale||saving||discard} aria-describedby={error?errorId:undefined}>{voice?<VoiceConditionsEditor resource={resource} conditions={conditions} setConditions={setConditions} disabled={!manager||stale||saving||discard} attempted={attempted}/>:<DetectionConditionsEditor resource={resource} conditions={conditions} setConditions={setConditions}/>}<label>修改说明{voice&&<span className="voice-note-optional">（选填）</span>}<Input name="rule-change-note" autoComplete="off" value={note} onChange={e=>setNote(e.target.value)} placeholder="记录本次规则调整"/></label></fieldset>
   </div>
   <div className="resource-dialog-footer">{!manager&&<p role="alert" className="form-error">仅主管可维护配置。</p>}{stale&&!saving&&<p role="alert" className="form-error">配置已更新，请关闭后重新编辑。</p>}{error&&<p id={errorId} ref={errorRef} tabIndex={-1} role="alert" className="form-error">{error}</p>}
    {discard?<><p role="alert">规则修改尚未保存，是否放弃？</p><div><Button onClick={()=>setDiscard(false)}>继续编辑</Button><Button intent="danger" onClick={onClose}>放弃修改</Button></div></>:<div><Button onClick={onClose} disabled={saving}>取消</Button><Button primary type="submit" disabled={!manager||stale||!dirty||saving}>{saving?'保存中…':'保存规则'}</Button></div>}
   </div>
  </form>
 </Modal>;
}
