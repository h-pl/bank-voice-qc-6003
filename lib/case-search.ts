import { callFor, canSee, person, type Entity, type State } from './workflow.ts';
export function caseSearchText(state: State, item: Entity, displayTitle = '') {
  const call = callFor(state, item.id);
  const ids = 'findingIds' in item ? item.findingIds : 'findingId' in item ? [item.findingId] : 'conclusions' in item ? [item.id] : 'batches' in item ? state.findings.filter(f => f.callId === item.id).map(f => f.id) : [];
  const findings = state.findings.filter(f => ids.includes(f.id) && canSee(state, f.id));
  return [item.id, displayTitle, 'title' in item ? item.title : '', 'note' in item ? item.note : '', 'scope' in item ? item.scope : '', 'goal' in item ? item.goal : '', call?.id, call ? person(call.agentId)?.name : '', ...findings.flatMap(f => [f.id, f.title]), ...state.reviews.filter(r => r.callId === call?.id && canSee(state, r.id)).map(r => r.id)].join(' ').toLowerCase();
}
