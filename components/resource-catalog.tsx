'use client';
import {useRef,useState} from 'react';
import {Button,SearchField,Empty} from './ui';
import {Button as ShadcnButton} from './ui/button';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from './ui/table';
import {ScrollArea} from './ui/scroll-area';
import {ResetFiltersButton} from './reset-filters-button';
import {stamp} from './workspace';
import {Icon} from './icon';
import {indicatorName,sortByStrategyRequirement} from '../lib/strategy-schema';
import {ResourceDialog} from './rule-resource-dialog';
import {resourceRows} from '../lib/resource-import';
import {roleOf,type State,type Command} from '../lib/workflow';
export function ResourceCatalog({state,focus,onOpen,onSubmit}: {state:State;focus?:string;onOpen:(id:string)=>void;onAction:(id:string,action:string)=>void;onSubmit:(cmd:Command)=>void}) {
 const [search,setSearch]=useState(''),[editing,setEditing]=useState<string>();
 const trigger=useRef<HTMLElement|null>(null);
 const selected=state.resources.find(r=>r.id===(editing??focus)),manager=roleOf(state)==='supervisor';
 const rows=sortByStrategyRequirement(state.rules).flatMap(rule=>state.resources.filter(r=>r.id===rule.resourceId)).filter(r=>`${r.id} ${r.name} ${state.rules.find(x=>x.resourceId===r.id)?.name}`.includes(search.trim()));
 const reset=()=>{setSearch('');};
 const open=(id:string,edit=false)=>{trigger.current=document.activeElement as HTMLElement;if(edit)setEditing(id);else onOpen(id);};
 const close=()=>{setEditing(undefined);if(focus)onOpen('');requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));};
 const columns=<colgroup><col className="resource-column-name"/><col className="resource-column-count"/><col className="resource-column-indicator"/><col className="resource-column-rule"/><col className="resource-column-date"/><col className="resource-column-actions"/></colgroup>;
 const headings=<TableRow><TableHead>业务资源</TableHead><TableHead>记录</TableHead><TableHead>对应指标</TableHead><TableHead>对应规则</TableHead><TableHead>更新时间</TableHead><TableHead className="resource-actions-heading">操作</TableHead></TableRow>;
 return <><div className="resource-workspace ui6003">
 <div className="catalog-toolbar resource-workspace-filters"><SearchField name="resource-search" label="搜索资源" placeholder="搜索资源或指标…" value={search} onValueChange={value=>{setSearch(value);}}/><ResetFiltersButton active={!!search} onClick={reset}/></div>
 <ScrollArea className="resource-catalog panel" id="resource-results" role="region" aria-label="业务资源列表" viewportClassName="resource-table-scroll" viewportLabel="业务资源表格，可滚动" header={<Table className="resource-table" aria-hidden="true">{columns}<TableHeader>{headings}</TableHeader></Table>}><Table className="resource-table">{columns}<TableHeader className="resource-accessible-header">{headings}</TableHeader><TableBody>{rows.map(r=>{const rule=state.rules.find(x=>x.resourceId===r.id),kind=r.kind==='professional'?'sop':r.kind;const count=resourceRows(kind,r.content).length+(r.knowledge?resourceRows('knowledge',r.knowledge).length:0);return <TableRow key={r.id} onClick={event=>{if((event.target as HTMLElement).closest('button,a,input')||!window.getSelection()?.isCollapsed)return;event.currentTarget.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});open(r.id);}}><TableCell><div className="resource-name"><span className="resource-type-icon"><Icon name={r.type==='SOP'?'sliders':r.type==='词库'?'database':'file'}/></span><div className="resource-name-details"><div className="resource-title-line"><ShadcnButton variant="ghost" className="resource-open" aria-label={`查看资源 ${r.name}`} onClick={()=>open(r.id)}><b>{r.name}</b></ShadcnButton></div></div></div></TableCell><TableCell>{count} 条</TableCell><TableCell>{indicatorName(r.indicator)}</TableCell><TableCell>{rule?.name}</TableCell><TableCell className="resource-date">{stamp(r.updatedAt)}</TableCell><TableCell><div className="resource-row-actions"><ShadcnButton variant="link" size="sm" onClick={()=>open(r.id)}>查看</ShadcnButton>{manager&&<ShadcnButton variant="link" size="sm" onClick={()=>open(r.id,true)}>编辑</ShadcnButton>}</div></TableCell></TableRow>;})}</TableBody></Table>{!rows.length&&<Empty text="没有符合条件的资源" hint="调整搜索关键词。" action={<Button onClick={reset}>重置筛选</Button>}/>}</ScrollArea></div>
 {selected&&<ResourceDialog key={`${selected.id}-${!!editing}`} state={state} resource={selected} initialEdit={!!editing} onSubmit={onSubmit} onClose={close}/>}</>;
}
