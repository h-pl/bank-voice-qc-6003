import {people,type State,type FlowTemplate} from './workflow.ts';

// New inspector work goes to the person with the fewest unfinished reviews.
// Stable IDs break ties; existing work is never reassigned here.
export function flowOwner(s:State,flow:FlowTemplate):string|undefined {
 if(flow.firstNode==='supervisor')return people.find(p=>p.id===flow.owner&&p.role==='supervisor')?.id;
 const load=(id:string)=>s.reviews.filter(r=>r.owner===id&&!['done','cancelled'].includes(r.status)).length;
 return people.filter(p=>p.role==='inspector').sort((a,b)=>load(a.id)-load(b.id)||a.id.localeCompare(b.id))[0]?.id;
}
