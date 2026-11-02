"use client";
import {useState,useRef,useEffect,useId} from 'react';
import {Button,Badge,Tabs,Modal,SearchField,Empty,DetailNavigation} from './ui';
import {Input} from './ui/input';
import {Button as FieldButton} from './ui/button';
import {Popover,PopoverTrigger,PopoverContent} from './ui/popover';
import {ChevronDownIcon} from 'lucide-react';
import {SelectField} from './select-field';
import {Checkbox} from './ui/checkbox';
import {Switch} from './ui/switch';
import {ScrollArea} from './ui/scroll-area';
import {RecordRow} from './record-id';
import {ResetFiltersButton} from './reset-filters-button';
import {ResourceHint} from './resource-hint';
import {ResourceDialog} from './rule-resource-dialog';
import {IndicatorRuleDialog} from './indicator-rule-dialog';
import {roleOf,roleNames,type State,type Command,type Policy,type Role,type Rule} from '../lib/workflow';
import {policyFor} from '../lib/configuration';
import {supportsWarning,indicatorName,sortByStrategyRequirement} from '../lib/strategy-schema';
import {allowNavigation} from './rule-editor';
const reminderFrequencyLabel=(seconds=0)=>seconds===0?'每通话一次':seconds===60?'每隔 1 分钟':seconds===300?'每隔 5 分钟':`每隔 ${seconds} 秒`;
const policyLevelTone={high:'danger',medium:'warning',low:'info'};
const policyRecipientsLabel=(policy:Pick<Policy,'recipients'>)=>policy.recipients.map(role=>({supervisor:'所属主管',inspector:'质检员',agent:'当前坐席'})[role]).join('、');
export const levelLabel={high:'高',medium:'中',low:'低',none:'无待办自动风险'};
export function Strategy({state,focus,onSubmit,onOpen,detailOnly=false,embedded=false}: {state:State;view:'rules'|'resources';focus?:string;detailOnly?:boolean;embedded?:boolean;onAction:(id:string,a:string)=>void;onSubmit:(c:Command)=>void;onOpen:(id:string)=>void}) {
 const panelId=useId();
 const [selectedTab,setTab]=useState('indicators'),[search,setSearch]=useState(''),[category,setCategory]=useState('all'),[association,setAssociation]=useState('all');
 const [editing,setEditing]=useState<Policy|'new'>(),[resource,setResource]=useState<{id:string;edit:boolean}>(),[error,setError]=useState(''),[editingRule,setEditingRule]=useState<string>();
 const [previewPolicy,setPreviewPolicy]=useState<Policy>(),[previewRule,setPreviewRule]=useState<string>();
 const manager=roleOf(state)==='supervisor';
 const tab=state.policies.some(p=>p.id===focus)?'policies':state.rules.some(r=>r.id===focus)?'indicators':selectedTab;
 const indicators=tab==='indicators';
 const rows=(indicators?sortByStrategyRequirement(state.rules):state.policies).filter(item=>{
  if(!`${item.name} ${'indicator' in item?indicatorName(item.indicator):''}`.toLowerCase().includes(search.trim().toLowerCase()))return false;
  if(category!=='all'&&('enabled' in item?(item.enabled?'on':'off'):item.level)!==category)return false;
  if(!indicators||!('indicator' in item)||association==='all')return true;
  if(!supportsWarning(item.indicator))return association==='not-applicable';
  return association===(policyFor(state,item.id)?'linked':'unlinked');
 });
 const enabledCount=rows.filter(item=>'enabled' in item&&item.enabled).length;
 const hasFilters=!!search||category!=='all'||(indicators&&association!=='all');
 const current=rows.find(r=>r.id===focus)??rows[0];
 const rule=current&&'enabled' in current?current:undefined,policy=current&&'ruleIds' in current?current:undefined;
 const policyFlow=policy?state.flows.find(f=>f.id===policy.flowId):undefined;
 const basis=rule?state.resources.find(r=>r.id===rule.resourceId):undefined,linked=rule?policyFor(state,rule.id):undefined;
 const previewedRule=state.rules.find(r=>r.id===previewRule);
 const choose=(id:string)=>{if(allowNavigation()){setTab(tab);onOpen(id);}};
 const reset=()=>{setSearch('');setCategory('all');setAssociation('all');onOpen('');};
 const toggle=(item:Rule)=>{try{onSubmit({id:item.id,rev:item.rev,action:'toggle_indicator',requestId:crypto.randomUUID(),input:{}});setError('');}catch(e){setError((e as Error).message);}};
 return <>
  <div className="strategy-nav ui6003" style={detailOnly?{display:'none'}:undefined}><div className="strategy-mode-toolbar"><Tabs panelId={panelId} label="质检策略分类" value={tab} onChange={value=>{if(allowNavigation()){setTab(value);reset();}}} options={[{value:'indicators',label:'指标规则',count:state.rules.length},{value:'policies',label:'预警策略',count:state.policies.length}]}/></div>
  {!detailOnly&&<div className="strategy-filters"><SearchField name="policy-search" label={indicators?'搜索规则':'搜索策略'} placeholder={indicators?'搜索规则或指标名称…':'搜索策略名称…'} value={search} onValueChange={value=>{setSearch(value);onOpen('');}}/><label className="policy-category"><span>{indicators?'指标状态':'风险等级'}</span><SelectField aria-label={indicators?'指标状态筛选':'风险等级筛选'} value={category} onValueChange={value=>{setCategory(value);onOpen('');}}><option value="all">{indicators?'全部状态':'全部等级'}</option>{(indicators?[['on','已开启'],['off','已关闭']]:[['high','高风险'],['medium','中风险'],['low','低风险']]).map(([v,label])=><option key={v} value={v}>{label}</option>)}</SelectField></label>{indicators&&<label className="policy-category"><span>策略关联</span><SelectField aria-label="策略关联筛选" value={association} onValueChange={value=>{setAssociation(value);onOpen('');}}><option value="all">全部关联状态</option><option value="linked">已关联策略</option><option value="unlinked">未关联策略</option><option value="not-applicable">无需策略</option></SelectField></label>}<ResetFiltersButton active={hasFilters} onClick={reset}/><div className="strategy-filter-actions">{!indicators&&manager&&<Button primary icon="plus" onClick={()=>setEditing('new')}>新增预警策略</Button>}</div></div>}</div>
  <div id={panelId} role={detailOnly?undefined:"tabpanel"} aria-labelledby={detailOnly?undefined:`${panelId}-tab-${tab}`} className={`policy-layout rule-layout strategy-redesign ui6003 ${focus?'has-selection':''} ${detailOnly?'policy-full-detail':''}`}>
   {!detailOnly&&<aside className="policy-list panel" aria-label={indicators?'规则列表':'策略列表'}><header className="policy-queue-heading"><b>{indicators?'指标规则':'策略列表'}</b><span className="policy-queue-count" role="status" aria-atomic="true" aria-label={indicators?`当前列表已开启 ${enabledCount} 项，共 ${rows.length} 项`:`共 ${rows.length} 项`}>{indicators?<>已开启 {enabledCount} / {rows.length}</>:<>{rows.length} 项</>}</span></header><ScrollArea className="policy-list-scroll" viewportLabel={indicators?'指标规则列表，可滚动':'预警策略列表，可滚动'}><div className="policy-items">{rows.map(item=><RecordRow key={item.id} label={`查看${indicators?'规则':'策略'} ${item.name}`} className={`policy-item ${indicators?'indicator-rule-card':''} ${current?.id===item.id?'selected':''}`} selected={current?.id===item.id} onOpen={()=>choose(item.id)}>{'enabled' in item?<><span className="indicator-card-heading"><strong>{item.name}</strong><span className="indicator-card-indicator">{indicatorName(item.indicator)}</span></span><span className="indicator-card-field"><span className="indicator-card-label">关联资源</span><span>{state.resources.find(r=>r.id===item.resourceId)?.name??'资源缺失'}</span></span><span className="indicator-card-field indicator-card-alerts"><span className="indicator-card-label">预警策略</span><span className="indicator-card-alert-summary">{supportsWarning(item.indicator)?policyFor(state,item.id)?.name??'系统默认设置':'不关联'}</span><label className="indicator-card-toggle"><Switch className="indicator-switch" aria-label={`${indicatorName(item.indicator)}指标开关`} checked={item.enabled} disabled={!manager} onCheckedChange={()=>toggle(item)}/></label></span></>:<><span className="shared-policy-card-heading"><strong>{item.name}</strong><Badge tone={policyLevelTone[item.level]}>{levelLabel[item.level]}风险</Badge></span><span className="rule-card-facts shared-policy-card-facts"><span><small>规则</small>{item.ruleIds.length} 条</span><span><small>通知</small>{policyRecipientsLabel(item)}</span><span><small>流转</small>{state.flows.find(f=>f.id===item.flowId)?.name??'优先质检主管'}</span></span></>}</RecordRow>)}{!rows.length&&<Empty text={indicators?'未找到指标规则':'未找到策略'}/>}</div></ScrollArea></aside>}
   <section className={`policy-detail panel ${policy?'warning-policy-detail':''}`} aria-label={indicators?'规则详情':'策略详情'}>{current?<>
    {detailOnly&&!embedded&&<DetailNavigation label="返回列表" onBack={()=>choose('')}/>}<div className="policy-mobile-back"><Button onClick={()=>choose('')}>返回列表</Button></div>
    <header className={`policy-heading ${rule?'rule-heading':''}`}><div><div className="policy-identity"><h2>{current.name}</h2>{policy&&<Badge tone={policyLevelTone[policy.level]}>{levelLabel[policy.level]}风险</Badge>}</div></div></header>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {rule&&<>
     <section className="policy-section rule-configuration">
      <div className="policy-section-title"><h3 className="policy-title-with-info">规则<ResourceHint label="规则配置说明">检测特征、检测对象、检查阶段、次数和持续时长在编辑规则中配置。指标开启后执行本规则。</ResourceHint></h3>{manager&&supportsWarning(rule.indicator)&&<Button onClick={()=>setEditingRule(rule.id)}>编辑规则</Button>}</div>
      <RuleConditionSummary rule={rule}/>
     </section>
     <section className="policy-section rule-resource">
      <div className="policy-section-title"><h3 className="policy-title-with-info">关联资源<ResourceHint label="关联资源说明">当前指标使用的业务内容。资源内容在业务资源中编辑，保存后用于后续新启动的检测。</ResourceHint></h3>{basis&&<Button onClick={()=>setResource({id:basis.id,edit:false})}>查看资源</Button>}</div>
      <dl className="rule-detail-fields"><div><dt>资源名称</dt><dd>{basis?.name??'资源缺失'}</dd></div></dl>
     </section>
     <section className="policy-section rule-linked-policy">
      <div className="policy-section-title"><h3 className="policy-title-with-info">引用策略<ResourceHint label="引用策略说明">主管在「预警策略 → 配置策略 → 适用规则」中维护关联。每条规则最多关联一条生效策略，此处只读查看；未关联时使用系统默认设置。</ResourceHint></h3>{linked&&<Button onClick={()=>setPreviewPolicy(linked)}>查看策略</Button>}</div>
      {supportsWarning(rule.indicator)?<dl className="rule-detail-fields"><div className="rule-detail-wide"><dt>关联策略</dt><dd className="rule-policy-name"><strong>{linked?.name??'未关联，使用系统默认设置'}</strong>{linked&&<span className="rule-policy-sharing">{linked.ruleIds.length>1?`${linked.ruleIds.length} 条规则共用`:'已关联 1 条规则'}</span>}</dd></div><div><dt>预警等级</dt><dd>{levelLabel[linked?.level??state.defaults.level]}</dd></div><div><dt>通知接收人</dt><dd>{linked?policyRecipientsLabel(linked):state.defaults.recipients.map(r=>roleNames[r]).join('、')}</dd></div><div><dt>重复提醒</dt><dd>{reminderFrequencyLabel(linked?.reminderIntervalSeconds)}</dd></div><div><dt>处理流程</dt><dd>{state.flows.find(f=>f.id===(linked?.flowId??'default'))?.name??'优先质检主管'}</dd></div></dl>:<p className="policy-readonly">本指标提供处理结果，不关联预警策略。</p>}
     </section>
    </>}
    {policy&&<>
     <section className="policy-section shared-policy-parameters">
      <div className="policy-section-title"><h3>通知与处理</h3><Button onClick={()=>setEditing(policy)}>{manager?'配置策略':'查看配置'}</Button></div>
      <dl className="rule-detail-fields policy-summary-fields">
       <div><dt>通知接收人</dt><dd>{policyRecipientsLabel(policy)}</dd></div>
       <div><dt>重复提醒<ResourceHint label="策略重复提醒说明">首次命中立即提醒，再次命中且达到间隔时再次提醒。每个新问题单独创建办理待办。</ResourceHint></dt><dd>{reminderFrequencyLabel(policy.reminderIntervalSeconds)}</dd></div>
       <div><dt>处理流程<ResourceHint label="策略处理流程说明">通知接收人与流程责任人分别配置。{policyFlow?<>{policyFlow.returnPath}；{policyFlow.endPath}。</>:'所关联流程已缺失，请重新配置。'}</ResourceHint></dt><dd>{policyFlow?.name??'流程缺失'}</dd></div>
       <div><dt>首节点</dt><dd>{policyFlow?policyFlow.firstNode==='inspector'?'质检员 · 系统自动分流':'质检主管 · 所属主管':'未配置'}</dd></div>
      </dl>
     </section>
     <section className="policy-section resource-references">
      <div className="policy-section-title"><h3 className="policy-title-with-info">适用规则<ResourceHint label="关联规则说明">每条规则最多关联一个策略。指标开关与指标规则页同步。开启后命中按本策略预警，关闭后停止该指标的后续检测。</ResourceHint><span className="policy-rule-count">{policy.ruleIds.length} 条</span></h3></div>
      {policy.ruleIds.length?<table className="policy-rules-table" aria-label="策略适用规则">
       <thead><tr><th scope="col">规则名称</th><th scope="col">对应指标</th><th scope="col">指标状态</th><th scope="col">操作</th></tr></thead>
       <tbody>{policy.ruleIds.map(id=>{const r=state.rules.find(r=>r.id===id);return <tr key={id}>
        <td>{r?.name??'规则缺失'}</td><td>{r?indicatorName(r.indicator):'请重新配置适用规则'}</td>
        <td>{r?<Switch className="indicator-switch" aria-label={`${indicatorName(r.indicator)}指标开关`} checked={r.enabled} disabled={!manager} onCheckedChange={()=>toggle(r)}/>:<span className="policy-rule-status">已移除</span>}</td>
        <td><Button disabled={!r} onClick={()=>setPreviewRule(id)}>查看规则<span className="sr-only">：{r?.name??'已移除规则'}</span></Button></td>
       </tr>;})}</tbody>
      </table>:<Empty text="暂无适用规则"/>}
     </section>
    </>}

   </>:<Empty text="暂无可查看的内容"/>}</section>
  </div>
  {editingRule&&<IndicatorRuleDialog key={editingRule} state={state} rule={state.rules.find(r=>r.id===editingRule)!} onSubmit={onSubmit} onClose={()=>setEditingRule(undefined)}/>}
  {resource&&<ResourceDialog key={resource.id} state={state} resource={state.resources.find(r=>r.id===resource.id)!} initialEdit={resource.edit} allowEdit={false} onClose={()=>setResource(undefined)} onSubmit={onSubmit}/>}
  {previewPolicy&&<PolicyEditor state={state} policy={previewPolicy} readOnly onSubmit={onSubmit} onClose={()=>setPreviewPolicy(undefined)}/>}
  {previewedRule&&<RulePreviewDialog state={state} rule={previewedRule} onClose={()=>setPreviewRule(undefined)}/>}
  {editing&&<PolicyEditor key={editing==='new'?'new':editing.id} state={state} policy={editing==='new'?undefined:editing} onSubmit={onSubmit} onClose={()=>setEditing(undefined)}/>}
 </>;
}

function RuleConditionSummary({rule}:{rule:Rule}) {
 return <>{supportsWarning(rule.indicator)?<div className="rule-condition-summary">{rule.conditions.some(c=>c.enabled!==false)?<table className="rule-condition-table" aria-label="规则检测条件"><thead><tr><th scope="col">命中特征</th><th scope="col">检测对象</th><th scope="col">检查阶段</th><th scope="col">触发条件</th></tr></thead><tbody>{rule.conditions.filter(c=>c.enabled!==false).map((c,i)=><tr key={i}><td>{c.feature}</td><td>{c.role}</td><td>{c.stage}{['开场','结束'].includes(c.stage)?` ${c.stageSeconds} 秒`:c.stage==='服务中'?`（开始后 ${c.middleStartSeconds??0} 秒至结束前 ${c.middleEndSeconds??0} 秒）`:''}</td><td>{c.mode}{c.mode==='累计次数'?` ≥ ${c.count} 次（${c.windowSeconds?`最近 ${c.windowSeconds} 秒`:'整通通话'}）`:c.mode==='持续时长'?` ≥ ${c.duration} 秒`:''}{c.speed?` · ${c.speed} 字/分钟`:''}</td></tr>)}</tbody></table>:<p className="policy-readonly">暂无启用的检测条件</p>}</div>:<p className="policy-readonly">{rule.indicator==='6.2.2'?'使用识别热词生成带角色和时间范围的转写结果。':'使用纠错词库修订转写，保留原文、修订文与差异。'}</p>}</>;
}
function RulePreviewDialog({state,rule,onClose}:{state:State;rule:Rule;onClose:()=>void}) {
 const resource=state.resources.find(item=>item.id===rule.resourceId);
 return <Modal title={rule.name} variant="resource" onClose={onClose}>
  <div className="rule-preview-content ui6003">
   <section className="rule-preview-section">
    <h3 className="policy-title-with-info">规则<ResourceHint label="规则配置说明">当前规则的检测特征、检测对象、检查阶段和触发条件。指标开启后执行本规则。</ResourceHint></h3>
    <RuleConditionSummary rule={rule}/>
   </section>
   <section className="rule-preview-section">
    <h3 className="policy-title-with-info">关联资源<ResourceHint label="关联资源说明">当前规则使用的业务资源。</ResourceHint></h3>
    <dl className="rule-detail-fields"><div><dt>资源名称</dt><dd>{resource?.name??'资源缺失'}</dd></div></dl>
   </section>
  </div>
 </Modal>;
}

function PolicyEditor({state,policy,onSubmit,onClose,readOnly=false}:{state:State;policy?:Policy;readOnly?:boolean;onSubmit:(c:Command)=>void;onClose:()=>void}) {
 const [initial]=useState<Omit<Policy,'id'|'rev'|'updatedAt'|'method'>>(()=>policy?{name:policy.name,ruleIds:[...policy.ruleIds],level:policy.level,recipients:[...policy.recipients],flowId:policy.flowId,reminderIntervalSeconds:policy.reminderIntervalSeconds??0}:{name:'',ruleIds:[],level:'medium',recipients:['supervisor'],flowId:'default',reminderIntervalSeconds:0});
 const [data,setData]=useState(initial),[error,setError]=useState(''),[deleting,setDeleting]=useState(false),[discard,setDiscard]=useState(false);
 const [frequency,setFrequency]=useState(()=>[0,60,300].includes(initial.reminderIntervalSeconds??0)?String(initial.reminderIntervalSeconds??0):'custom');
 const [customInterval,setCustomInterval]=useState(String(initial.reminderIntervalSeconds||60));
 const intervalRef=useRef<HTMLInputElement>(null),intervalErrorId=useId();
 const intervalInvalid=frequency==='custom'&&(!/^\d+$/.test(customInterval)||Number(customInterval)<1||Number(customInterval)>86400);
 const selectedFlow=state.flows.find(f=>f.id===data.flowId);
 const errorRef=useRef<HTMLParagraphElement>(null),errorId=useId();
 useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
 const manager=roleOf(state)==='supervisor'&&!readOnly,target=policy??state.rules[0],dirty=JSON.stringify(data)!==JSON.stringify(initial);
 const update=(patch:Partial<typeof data>)=>{setData({...data,...patch});setError('');setDeleting(false);};
 const close=()=>{if(dirty)setDiscard(true);else onClose();};
 const submit=(remove=false)=>{if(!remove&&intervalInvalid){intervalRef.current?.focus();return;}try{onSubmit({id:target.id,rev:target.rev,requestId:crypto.randomUUID(),action:remove?'delete_policy':policy?'save_policy':'create_policy',input:{policy:data,note:remove?'删除策略，所关联规则使用系统默认设置':'保存预警策略'}});onClose();}catch(e){setError((e as Error).message);}};
 return <Modal variant="action" title={policy?`${manager?'编辑':'查看'}预警策略`:'新增预警策略'} description={policy?.name} onClose={close}>
 <form className="action-form shared-policy-editor policy6003-editor ui6003" noValidate onSubmit={e=>{e.preventDefault();if(manager&&!discard)submit();}}><div className="action-form-body">
 <fieldset disabled={!manager} className="policy-form">
 <div className="indicator-config-form policy6003-basics">
 <label>策略名称<Input name="policyName" autoComplete="off" required value={data.name} maxLength={100} placeholder="例如：合规安全预警" aria-invalid={!!error&&!data.name.trim()} aria-describedby={error?errorId:undefined} onChange={e=>update({name:e.target.value})}/></label>
 <label>预警等级<SelectField aria-label="预警等级" disabled={!manager} required value={data.level} onValueChange={v=>update({level:v as Policy['level']})}>{(['high','medium','low'] as const).map(v=><option key={v} value={v}>{levelLabel[v]}风险</option>)}</SelectField></label>
 </div>
 <fieldset className="configuration-fieldset"><legend><span className="config-label-with-info">适用规则<ResourceHint label="关联规则选择说明">同一策略可关联多条规则，每条规则最多关联一个策略。已被其他策略使用的规则会显示所属策略。</ResourceHint><small className="policy6003-selection-count">已选 {data.ruleIds.length} 条</small></span></legend>
 {!state.rules.some(r=>supportsWarning(r.indicator)&&!state.policies.some(p=>p.id!==policy?.id&&p.ruleIds.includes(r.id)))&&<p className="policy-readonly">当前规则均已被其他策略使用，调整原策略关联后可选。</p>}
 <div className="policy6003-rule-options" role="group" aria-label="适用规则">{state.rules.filter(r=>supportsWarning(r.indicator)).sort((a,b)=>Number(initial.ruleIds.includes(b.id))-Number(initial.ruleIds.includes(a.id))).map(r=>{const linkedPolicy=state.policies.find(p=>p.ruleIds.includes(r.id)),used=linkedPolicy&&linkedPolicy.id!==policy?.id;const policyName=linkedPolicy?Array.from(linkedPolicy.name):[];return <label className={`policy6003-rule-option ${used?'is-unavailable':''}`} key={r.id}><Checkbox disabled={!!used||!manager} checked={data.ruleIds.includes(r.id)} onCheckedChange={checked=>update({ruleIds:checked?[...data.ruleIds,r.id]:data.ruleIds.filter(id=>id!==r.id)})}/><span><strong>{r.name}</strong>{linkedPolicy&&<small title={`已关联「${levelLabel[linkedPolicy.level]}风险 ${linkedPolicy.name}」`}>已关联「{levelLabel[linkedPolicy.level]}风险 {policyName.slice(0,6).join('')}{policyName.length>6?'...':''}」</small>}</span></label>;})}</div></fieldset>
 <fieldset className="configuration-fieldset policy6003-notifications"><legend><span className="config-label-with-info">通知设置<ResourceHint label="通知设置说明">命中后通知所选接收人，消息统一进入通知中心和提醒列表。</ResourceHint></span></legend>
 <div className="indicator-config-form policy6003-frequency policy6003-notification-row">
 <div className="policy6003-field"><span className="config-label-with-info">通知接收人</span><Popover><PopoverTrigger asChild><FieldButton type="button" variant="outline" className="policy6003-recipient-select" aria-label="通知接收人" disabled={!manager} aria-invalid={!!error&&!data.recipients.length} aria-describedby={error?errorId:undefined}><span>{data.recipients.length?policyRecipientsLabel(data):'请选择接收人'}</span><ChevronDownIcon size={16}/></FieldButton></PopoverTrigger><PopoverContent align="start" className="policy6003-recipient-options" aria-label="选择通知接收人" onEscapeKeyDown={e=>e.stopPropagation()}>{(['supervisor','inspector','agent'] as Role[]).map(role=><label className="policy6003-recipient-option" key={role}><Checkbox disabled={!manager} checked={data.recipients.includes(role)} onCheckedChange={checked=>update({recipients:(['supervisor','inspector','agent'] as Role[]).filter(r=>r===role?checked:data.recipients.includes(r))})}/>{{supervisor:'所属主管',inspector:'质检员',agent:'当前坐席'}[role]}</label>)}</PopoverContent></Popover></div>
 <div className="policy6003-field"><span className="config-label-with-info">重复提醒<ResourceHint label="重复提醒说明">同一通话、同一策略对同一接收人首次立即提醒，再次命中且达到间隔时再次提醒。每通话一次只发送首次提醒；每个新问题仍单独创建办理待办。</ResourceHint></span><SelectField aria-label="重复提醒" disabled={!manager} value={frequency} onValueChange={v=>{setFrequency(v);update({reminderIntervalSeconds:v==='custom'?Number(customInterval):Number(v)});}}><option value="0">每通话一次</option><option value="60">每隔 1 分钟</option><option value="300">每隔 5 分钟</option><option value="custom">自定义</option></SelectField>{frequency==='custom'&&<label>自定义间隔（秒）<Input ref={intervalRef} name="reminderInterval" type="number" min={1} max={86400} step={1} value={customInterval} aria-invalid={intervalInvalid} aria-describedby={intervalErrorId} onChange={e=>{setCustomInterval(e.target.value);update({reminderIntervalSeconds:e.target.value===''?NaN:Number(e.target.value)});}}/><small id={intervalErrorId} className={intervalInvalid?'form-error':undefined}>{intervalInvalid?'请输入 1–86400 的整数秒':'范围：1–86400 秒'}</small></label>}</div>
 <div className="policy6003-field"><span className="config-label-with-info">处理流程<ResourceHint label="处理流程说明">流程负责创建待办并指派责任人，通知接收人单独配置。{selectedFlow&&<>首节点：{selectedFlow.firstNode==='inspector'?'质检员 · 系统自动分流':'质检主管 · 所属主管'}；{selectedFlow.returnPath}；{selectedFlow.endPath}。</>}</ResourceHint></span><SelectField aria-label="处理流程" disabled={!manager} value={data.flowId} onValueChange={flowId=>update({flowId})}>{state.flows.filter(f=>f.enabled).map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</SelectField>{selectedFlow?.firstNode==='inspector'&&<p className="policy-readonly">首节点：质检员 · 系统自动分流</p>}</div>

 </div>
 </fieldset>
</fieldset>
 </div><div className="modal-actions policy-config-footer">
 {error&&<p id={errorId} ref={errorRef} tabIndex={-1} role="alert" className="form-error">{error}</p>}
 {discard?<div className="policy-footer-row dialog-footer-row"><p role="alert" className="dialog-footer-note">策略修改尚未保存，是否放弃？</p><div className="dialog-footer-actions"><Button onClick={()=>setDiscard(false)}>继续编辑</Button><Button intent="danger" onClick={onClose}>放弃修改</Button></div></div>:deleting?<div className="policy-footer-row dialog-footer-row"><p role="alert" className="dialog-footer-note">删除后，关联规则将使用系统默认设置。</p><div className="dialog-footer-actions"><Button onClick={()=>setDeleting(false)}>保留策略</Button><Button intent="danger" onClick={()=>submit(true)}>确认删除</Button></div></div>:<div className="policy-footer-row dialog-footer-row"><div className="policy6003-footer-secondary">{manager&&policy&&<Button onClick={()=>setDeleting(true)}>删除策略</Button>}</div><div className="dialog-footer-actions"><Button onClick={onClose}>{manager?'取消':'关闭'}</Button>{manager&&<Button primary type="submit" disabled={!dirty}>保存策略</Button>}</div></div>}
 </div></form></Modal>;
}
