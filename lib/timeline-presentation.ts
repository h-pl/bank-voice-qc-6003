import { canSee, canSeeCall, entity, type State } from './workflow.ts';

/** Hide internal revision labels in legacy generated messages; preserve stored audit data. */
export function businessRecordText(text: string): string {
  return text
    .replace(/：未引用\s*→\s*V\d+(?:\.\d+)*\b/gi, '：已关联引用')
    .replace(/：V\d+(?:\.\d+)*\s*→\s*V\d+(?:\.\d+)*\b/gi, '：引用已更新')
    .replace(/\s+V\d+(?:\.\d+)*\b(?=\s+已用于后续检测)/gi, '')
    .replace(/\s*[·/]\s*V\d+(?:\.\d+)*\b/gi, '')
    .replace(/(结论|标准|规则|资源|策略|口径)\s*V\d+(?:\.\d+)*\b/gi, '$1')
    .replace(/命中版本/g, '命中时的')
    .replace(/原结论版本/g, '原结论')
    .replace(/规则版本/g, '规则依据')
    .replace(/标准版本/g, '完成标准')
    .replace(/结论版本/g, '结论')
    .replace(/资源版本/g, '资源内容')
    .replace(/策略版本/g, '策略配置')
    .replace(/口径版本/g, '统计口径')
    .replace(/发布新版本/g, '发布更新')
    .replace(/版本已变化/g, '内容已变化');
}

export type TimelineReference = { id: string; label: string };
/** Use real entity relations; never infer a link solely from a shared call or an ID in prose. */
export function timelineReferences(state: State, target: string): TimelineReference[] {
  const item = entity(state, target);
  if (!item || !('batches' in item ? canSeeCall(state,item) : canSee(state,target))) return [];
  const ids = [target, ...('findingIds' in item ? item.findingIds : 'findingId' in item ? [item.findingId] : 'executor' in item ? [item.target] : [])];
  return [...new Set(ids)].flatMap(id => {
    const record = entity(state,id);
    if (!record || !('batches' in record ? canSeeCall(state,record) : canSee(state,id))) return [];
    const label = 'batches' in record ? '通话' : 'conclusions' in record ? '问题' : 'findingIds' in record ? record.type==='appeal' ? '申诉核查工单' : record.type==='spotcheck' ? '抽检工单' : '复核工单' : 'standardSequence' in record ? '整改' : 'conclusionSequence' in record ? '申诉' : 'executor' in record ? '补件' : '业务配置';
    return [{id,label}];
  });
}
