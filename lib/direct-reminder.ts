import type { Input } from './workflow.ts';

export type DirectReminderDraft = {
  content: string;
  standard: string;
  dueAt: string;
  responseDueAt?: string;
  evidence: number[];
  sampleCount: number;
  observation: string;
};

// Keep the existing distribution contract; the audit note uses the user's exact requirements.
export function directReminderInput(draft: DirectReminderDraft): Input {
  const goal = draft.content.trim();
  const standard = draft.standard.trim();
  if (goal.length < 4) throw new Error('请填写至少 4 个字的提醒内容。');
  if (standard.length < 4) throw new Error('请填写至少 4 个字的完成要求。');
  if (!draft.observation.trim() || !Number.isInteger(draft.sampleCount) || draft.sampleCount < 1 || draft.sampleCount > 20) {
    throw new Error('请调整核验要求：填写观察与复测要求，样例数须为 1–20 的整数。');
  }
  return {
    goal, standard, note: `提醒内容：${goal}\n完成要求：${standard}`,
    dueAt: draft.dueAt, responseDueAt:draft.responseDueAt, evidence: [...draft.evidence],
    sampleCount: draft.sampleCount, observation: draft.observation.trim(),
  };
}
