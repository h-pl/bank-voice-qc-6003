import { latest, type Entity, type State } from './workflow.ts';

/** User-facing lifecycle terms from PRD 7.11.3. Legacy-only states retain their existing fallback. */
export function lifecycleLabel(item:Entity,state?:State):string|undefined {
 if('conclusions' in item){
  if(latest(item)?.value==='false_positive')return item.source==='auto'?'误报归档':'人工问题已撤销';
  if(item.status==='candidate')return '待主管初审';
  if(item.status==='review'||item.status==='supplement')return '核实中';
  if(item.status==='delivered')return '已分发';
 }
 if('findingIds' in item){
  const supplement=state?.supplements.find(x=>x.target===(item.appealId??item.id)&&['pending','submitted'].includes(x.status));
  if(supplement&&!['done','cancelled'].includes(item.status))return supplement.status==='submitted'?(item.type==='appeal'?'待质检员接收补件':'待主管接收补件'):'待补充资料';
  if(item.type==='appeal'){
   const appeal=state?.appeals.find(a=>a.id===item.appealId);
   if(appeal?.status==='supplement')return '待坐席补充资料';
   if(item.status==='response')return '待质检员回应';
   if(item.status==='supervisor')return '待主管审核';
   if(['pending','working'].includes(item.status))return '核查中';
  }else{
   if(item.evidenceRequest)return '待主管安排补证';
   if(['pending','working'].includes(item.status))return '核实中';
   if(item.status==='supervisor')return '待主管确认';
  }
  if(item.status==='done')return '已完成';
 }
 if('standardSequence' in item&&!item.pause){
  if(item.status==='executing')return '整改中';
  if(item.status==='verification')return item.inspector?'待核验':'资料已提交 · 待指派核验';
  if(item.status==='supervisor'&&item.supervisorReason==='approve')return '待主管审核';
  if(item.status==='supervisor'&&item.supervisorReason==='adjust')return '待主管调整要求';
  if(item.status==='response')return '待质检员核对主管意见';
  if(item.status==='done')return '已完成';
 }
 if('conclusionSequence' in item&&!('standardSequence' in item)){
  if(item.status==='supplement'&&state?.supplements.some(x=>x.target===item.id&&x.status==='submitted'))return item.reviewId?'待质检员接收补件':'待主管接收补件';
  const review=state?.reviews.find(r=>r.id===item.reviewId);
  if(review?.status==='response')return '待质检员回应';
  return ({submitted:'待指派核查',accepted:'待指派核查',reviewing:'核查中',supplement:'待坐席补充资料',decision:'待主管审核',done:'已裁定'} as Record<string,string>)[item.status];
 }
}

export function reviewResultLabel(value:string,type:'candidate'|'spotcheck'|'appeal') {
 if(value==='insufficient')return '历史意见：证据不足';
 if(type==='spotcheck')return value==='risk'?'发现问题':'问题已撤销';
 if(type==='appeal')return value==='risk'?'申诉不成立':'申诉成立';
 return value==='risk'?'非误报':'误报';
}
