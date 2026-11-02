import type { Remedy } from './workflow.ts';
export const remedyReportStages = [['pending', '待接收'], ['executing', '整改中'], ['unassigned', '资料已提交·待指派核验'], ['verification', '待核验'], ['response', '待质检员核对主管意见'], ['supervisor', '待主管处理'], ['done', '已结案'], ['terminated', '已终止'], ['unknown', '状态待核对']] as const;
export function remedyReportStage(r: Remedy) {
  if (r.status === 'verification' && !r.inspector) return 'unassigned';
  return remedyReportStages.some(([key]) => key === r.status) ? r.status : 'unknown';
}
export const appealOutcomeLabels: Record<string, string> = {false_positive: '申诉成立·撤销原结论', maintain: '申诉不成立·维持原结论', adjust: '历史裁定·调整成立范围', insufficient: '历史裁定·证据不足'};
