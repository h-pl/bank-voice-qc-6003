'use client';
import {useState} from 'react';
import {Modal,Button} from './ui';
import {Checkbox} from './ui/checkbox';
import {roleOf,person,type State,type Command} from '../lib/workflow';
const fieldNames:Record<string,string>={name:'名称',content:'资源内容',knowledge:'业务知识',conditions:'检测条件',enabled:'指标开关',ruleIds:'关联规则',level:'预警等级',recipients:'通知接收人',method:'历史提醒方式',flowId:'处理流程',reminderIntervalSeconds:'提醒间隔（秒）',displayFields:'通话展示字段'};
function describe(value:unknown):string {if(value===null||value===undefined)return '未设置';if(typeof value==='boolean')return value?'开启':'关闭';if(typeof value==='object')return JSON.stringify(value,null,2);return ({high:'高',medium:'中',low:'低',supervisor:'质检主管',inspector:'质检员',agent:'坐席',notification:'站内通知',live:'通话中提醒'} as Record<string,string>)[String(value)]??String(value);}
export function ConfigurationHistory({state,target,fields}:{state:State;target:string;fields?:string[]}){
 const describeChange=(field:string,value:unknown)=>field==='ruleIds'&&Array.isArray(value)?value.map(id=>state.rules.find(r=>r.id===id)?.name??'已移除规则').join('、')||'未关联':describe(value);
 const logs=state.logs.filter(l=>l.target===target).map(l=>({...l,changes:l.changes?.filter(c=>c.field!=='inspectorGroupIds'&&(!fields||fields.includes(c.field)))})).filter(l=>l.changes?.length).toReversed();
 const content=logs.length?logs.map(l=><article key={l.id}><p>{new Date(l.at).toLocaleString('zh-CN')} · {person(l.actor)?.name??l.actor} · {fields?'更新设置':l.action}</p>{!fields&&<p>{l.note}</p>}<dl>{l.changes?.map(c=><div key={c.field}><dt>{fieldNames[c.field]??c.field}</dt><dd><span>修改前</span><pre>{describeChange(c.field,c.before)}</pre><span>修改后</span><pre>{describeChange(c.field,c.after)}</pre></dd></div>)}</dl></article>):<p>暂无修改记录</p>;
 return <details className="config-change-history"><summary>修改记录 · {logs.length}</summary>{content}</details>;
}
export function DisplaySettingsDialog({state,onSubmit,onClose}:{state:State;onSubmit:(c:Command)=>void;onClose:()=>void}){
 const [initial]=useState(()=>structuredClone(state.settings!));
 const [data,setData]=useState(initial),[error,setError]=useState(''),[discard,setDiscard]=useState(false);
 const manager=roleOf(state)==='supervisor',dirty=JSON.stringify(data)!==JSON.stringify(initial);
 const update=(patch:Partial<typeof data>)=>{setData({...data,...patch});setError('');};
 const close=()=>dirty?setDiscard(true):onClose();
 return <Modal title="列表展示设置" variant="action" onClose={close}>
  <form className="action-form ui6003 settings6003-form" onSubmit={e=>{
   e.preventDefault();if(!manager||!dirty||discard)return;
   try{onSubmit({id:initial.id,rev:initial.rev,action:'save_settings',requestId:crypto.randomUUID(),input:{settings:data,note:'更新告警列表展示字段'}});onClose();}catch(e){setError((e as Error).message);}
  }}>
   <div className="action-form-body"><fieldset disabled={!manager} className="policy-form">
    <fieldset className="configuration-fieldset"><legend>告警队列展示字段</legend><div className="condition-feature-options">
     {Object.entries({agent:'坐席',group:'班组',business:'业务',duration:'通话时长',detection:'检测状态'}).map(([key,name])=><label key={key} className="config-choice"><Checkbox checked={data.displayFields.includes(key)} onCheckedChange={yes=>update({displayFields:yes?[...data.displayFields,key]:data.displayFields.filter(f=>f!==key)})}/>{name}</label>)}
    </div></fieldset>
   </fieldset><ConfigurationHistory state={state} target={initial.id} fields={['displayFields']}/></div>
   <div className="modal-actions"><div className="dialog-footer-row">
    {error&&<p className="form-error" role="alert">{error}</p>}
    {discard?<><p>修改尚未保存，是否放弃？</p><div className="dialog-footer-actions"><Button onClick={()=>setDiscard(false)}>继续编辑</Button><Button onClick={onClose}>放弃修改</Button></div></>:<><span/><div className="dialog-footer-actions"><Button onClick={onClose}>{manager?'取消':'关闭'}</Button>{manager&&<Button primary type="submit" disabled={!dirty}>保存设置</Button>}</div></>}
   </div></div>
  </form>
 </Modal>;
}
