import type {Policy,State} from './workflow.ts';

const originalRules = {
 'POL-HIGH':['R-SOP-006','R-COM-012'],
 'POL-MEDIUM':['R-VOICE-001','R-KW-018','R-EM-002','R-INT-001','R-SVC-002','R-AC-003','R-BAN-001','R-SVC-009'],
};
const sameIds=(a:string[],b:string[])=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
export function policyPresets(updatedAt:string):Policy[]{
 return [
  {id:'POL-HIGH',rev:0,name:'合规安全预警',ruleIds:['R-VOICE-001','R-SOP-006','R-COM-012','R-BAN-001'],level:'high',recipients:['supervisor','inspector'],reminderIntervalSeconds:60,flowId:'default',method:'notification',updatedAt},
  {id:'POL-MEDIUM',rev:0,name:'服务质量预警',ruleIds:['R-KW-018','R-EM-002','R-INT-001','R-SVC-009'],level:'medium',recipients:['inspector'],reminderIntervalSeconds:300,flowId:'special-review',method:'notification',updatedAt},
  {id:'POL-LOW',rev:0,name:'服务规范预警',ruleIds:['R-SVC-002','R-AC-003'],level:'low',recipients:['agent'],reminderIntervalSeconds:0,flowId:'default',method:'notification',updatedAt},
 ];
}
/** Upgrade only the complete, untouched original demo. Never reset user configuration or evidence. */
export function upgradeUntouchedPolicyPresets(s:State):State {
 if(s.policies.length!==2||s.logs.some(l=>l.target.startsWith('POL-')&&l.changes?.length))return s;
 for(const [id,ruleIds] of Object.entries(originalRules)){
  const p=s.policies.find(p=>p.id===id),high=id==='POL-HIGH';
  if(!p||p.rev!==0||p.name!==(high?'高风险通知':'一般风险通知')||p.level!==(high?'high':'medium')||!sameIds(p.ruleIds,ruleIds)||!sameIds(p.recipients,['supervisor'])||p.flowId!=='default'||(p.reminderIntervalSeconds??0)!==0||(p.method&&p.method!=='notification'))return s;
 }
 if(!['default','special-review'].every(id=>s.flows.some(f=>f.id===id&&f.enabled)))return s;
 return {...s,policies:policyPresets(s.policies[0].updatedAt)};
}
