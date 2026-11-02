"use client";
import type {Dispatch,SetStateAction} from 'react';
import {ResourceHint} from './resource-hint';
import {SelectField} from './select-field';
import {Input} from './ui/input';
import {Checkbox} from './ui/checkbox';
import {conditionFeatures,conditionCapabilities,newCondition} from '../lib/configuration-schema';
import type {Resource,DetectionCondition} from '../lib/workflow';
export function DetectionConditionsEditor({resource,conditions,setConditions}:{resource:Resource;conditions:DetectionCondition[];setConditions:Dispatch<SetStateAction<DetectionCondition[]>>}){
 const features=conditionFeatures(resource);
 const options=[...new Set([...features,...conditions.map(c=>c.feature)])];
 if(!options.length)return null;
 return <section className="config-conditions"><h3 className="policy-title-with-info">检测条件<ResourceHint label="检测条件说明">按当前指标的检测特征分别配置角色、阶段和触发门槛，检测条件保存在指标规则中。满足任一有效条件后执行对应预警策略。</ResourceHint></h3><div className="condition-feature-options">{options.map(feature=><label className="config-choice" key={feature}><Checkbox checked={conditions.some(c=>c.feature===feature&&c.enabled!==false)} onCheckedChange={checked=>setConditions(rows=>rows.some(c=>c.feature===feature)?rows.map(c=>c.feature===feature?{...c,enabled:!!checked}:c):[...rows,newCondition(feature)])}/>{feature}{!features.includes(feature)&&<span className="form-error">资源中已移除，请取消触发</span>}</label>)}</div>{conditions.map((c,index)=><fieldset key={index} disabled={c.enabled===false}><legend>{c.feature}{c.enabled===false?' · 未选择':''}</legend><div className="indicator-config-form resource-condition-fields">
    {(['role','stage','mode'] as const).map(key=><label key={key}>{({role:'检测角色',stage:'检测阶段',mode:'触发方式'})[key]}<SelectField aria-label={`${c.feature} ${({role:'检测角色',stage:'检测阶段',mode:'触发方式'})[key]}`} value={c[key]} onValueChange={value=>setConditions(rows=>rows.map((row,i)=>i===index?{...row,[key]:value}:row))}>{conditionCapabilities(resource.kind,c.feature)[key==='role'?'roles':key==='stage'?'stages':'modes'].map(v=><option key={v}>{v}</option>)}</SelectField></label>)}
    {(['count','duration','windowSeconds','stageSeconds','middleStartSeconds','middleEndSeconds','speed'] as const).filter(key=>key==='count'?c.mode==='累计次数':key==='duration'?c.mode==='持续时长':key==='windowSeconds'?c.mode==='累计次数':key==='stageSeconds'?['开场','结束'].includes(c.stage):['middleStartSeconds','middleEndSeconds'].includes(key)?c.stage==='服务中':c.feature.startsWith('语速')).map(key=><label key={key}><span className="config-label-with-info">{({count:'累计次数',duration:'持续时长（秒）',windowSeconds:'统计窗口（秒）',stageSeconds:'阶段范围（秒）',middleStartSeconds:'开始后（秒）',middleEndSeconds:'结束前（秒）',speed:'语速阈值（字/分钟）'})[key]}{key==='windowSeconds'&&<ResourceHint label="统计窗口说明">填 0 时统计整通通话；其他值为指定秒数内的累计次数。</ResourceHint>}</span><Input type="number" min={['windowSeconds','middleStartSeconds','middleEndSeconds'].includes(key)?0:key==='speed'?30:1} max={key==='count'?1000:key==='speed'?600:3600} value={c[key]??30} onChange={e=>setConditions(rows=>rows.map((row,i)=>i===index?{...row,[key]:Number(e.target.value)}:row))}/></label>)}
   </div></fieldset>)}</section>;
}
