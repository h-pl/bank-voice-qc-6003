import { supportsWarning } from './strategy-schema.ts';
import { applyConfiguration, captureRules, captureBasis } from "./configuration.ts";
import { reconcileAlerts, replayDetection, applyAlertCommand } from "./call-alerts.ts";
import { taskDeadlineLimit, retainedWarningDeadline, lateWarningSubmission } from './task-deadlines.ts';
import type { AlertTiming } from "./alert-deadlines.ts";

export type Role = "supervisor" | "inspector" | "agent";
export type View =
  | "alerts"
  | "workorders"
  | "improvement"
  | "calls"
  | "rules"
  | "resources"
  | "reports";
export const defaultView: View = "workorders";
export const roleNames: Record<Role, string> = {
  supervisor: "质检主管",
  inspector: "质检员",
  agent: "客服坐席",
};
export const people = [
  { id: "S01", name: "何晴", role: "supervisor" },
  { id: "Q01", name: "赵宁", role: "inspector" },
  { id: "Q02", name: "林悦", role: "inspector" },
  { id: "A1048", name: "周敏", role: "agent" },
  { id: "A1186", name: "陈佳", role: "agent" },
] as const;
export const person = (id: string) => people.find((p) => p.id === id)!;
export const nav: Record<Role, View[]> = {
  supervisor: [
    "alerts",
    "workorders",
    "improvement",
    "calls",
    "rules",
    "resources",
    "reports",
  ],
  inspector: ["workorders", "improvement", "calls", "rules", "resources"],
  agent: ["workorders", "improvement", "calls"],
};
export type Verdict = "risk" | "false_positive" | "insufficient";
export const verdictNames: Record<Verdict, string> = {
  risk: "风险成立",
  false_positive: "误报 / 不成立",
  insufficient: "证据不足",
};
export type Base = { id: string; rev: number; deadlineChanges?: { from: string; to: string; at: string; reason: string }[] };
export type Segment = {
  at: number;
  speaker: "agent" | "customer";
  text: string;
};
export type Batch = {
  id: string;
  startedAt: string;
  endedAt?: string;
  rules: DetectionBasis[];
  checks: {
    name: string;
    state: "pending" | "running" | "success" | "failed";
  }[];
};
export type Call = Base & {
  agentId: string;
  business: string;
  group: string;
  customer: string;
  startedAt: string;
  endedAt?: string;
  duration: number;
  transcript: Segment[];
  corrections?: { segment: number; text: string; reason: string }[];
  audio?: string;
  authorized: string[];
  batches: Batch[];
  sample?: boolean;
  manualDetection?: { batchId: string; by: string; at: string; note: string };
};
export type Conclusion = {
  sequence: number;
  value: Verdict;
  note: string;
  at: string;
  by: string;
  reviewer?: string;
  noRemedy?: string;
  evidence?: number[];

  batchId?: string;
};
export type Distribution = {
  source: "direct" | "review" | "spotcheck";
  sequence: number;
  status: "pending" | "accepted" | "appealed";
  goal: string; standard: string; observation: string; sampleCount: number;
  dueAt: string; inspector: string; at: string;
  responseDueAt?: string; originalResponseDueAt?: string; originalDueAt?: string;
  responseOverdueAt?: string; completionOverdueAt?: string; respondedAt?: string;
  extensionRequest?: { note: string; at: string };
  deadlineHistory?: { at: string; dueAt: string; responseDueAt?: string; note: string }[];
};
export type Finding = Base & {
  alertTiming?: AlertTiming;
  detectionBasis?: { summary: string; checks: { requirement: string; observation: string; result: "待核对" | "待补证" | "符合" | "不符合" }[] };
  distribution?: Distribution;
  distributionHistory?: Distribution[];
  optimization?: { status: "pending" | "recorded" | "unnecessary"; note: string; by: string; at: string };

  callId: string;
  title: string;
  indicator: string;
  related: string[];
  ruleId: string;
  basis?: DetectionBasis;
  detectionKey?: string;
  problemKey?: string;
  hits?: DetectionHit[];
  pendingEvidence?: { hitIds: string[]; at: string };
  evidenceDecisions?: { at: string; by: string; note: string; outcome: "reopen" | "retain"; hitIds: string[] }[];
  reopenedAt?: string;
  reopenedAfterSequence?: number;
  flowConflict?: { hitIds: string[]; at: string; note?: string; resolvedAt?: string };
  workflow?: {flowId:string;policyName:string;reason?:string};
  batchId: string;
  source: "auto" | "manual";
  severity: "high" | "medium" | "low";
  evidence: number[];
  status:
    | "candidate"
    | "reminded"
    | "supplement"
    | "review"
    | "closed"
    | "delivered";
  conclusions: Conclusion[];
  assignment?: { owner: string; dueAt: string };
  reminder?: {
    text: string;
    sentAt: string;
    readAt?: string;
    feedback?: string;
    dissent?: string;
  };
  seenSequence?: number;
};
export type Opinion = { value: Verdict; note: string; evidence: number[] };
export type Review = Base & {
  callId: string;
  /** Zero only while a spotcheck has no finding; otherwise exactly one. */
  findingIds: string[];
  type: "candidate" | "spotcheck" | "appeal";
  scope: string;
  owner: string;
  dueAt: string;
  originalDueAt: string;
  status: "pending" | "working" | "supervisor" | "response" | "done" | "cancelled";
  supervisorComment?: string;
  opinions: Record<string, Opinion>;
  summary?: string;
  scopeResult?: "clear" | "insufficient";
  evidenceRequest?: { note: string; at: string };
  appealId?: string;
  finishedAt?: string;
  firstOverdueAt?: string;
  history: {
    at: string;
    opinions: Record<string, Opinion>;
    summary?: string;
  }[];
};
export type Appeal = Base & {
  findingId: string;
  conclusionSequence: number;
  agentId: string;
  status:
    | "submitted"
    | "supplement"
    | "accepted"
    | "reviewing"
    | "decision"
    | "done"
    | "withdrawn"
    | "rejected";
  note: string;
  evidence: number[];
  dueAt: string;
  originalDueAt: string;
  reviewId?: string;
  supplementOrigin?: string;
  sameReviewerReason?: string;
  outcome?: "maintain" | "false_positive" | "insufficient" | "adjust";
  decidedAt?: string;
  firstOverdueAt?: string;
};
export type Pause = {
  reasons: string[];
  startedAt: string;
  phase: string;
  owner: string;
  dueAt: string;
  wasOverdue: boolean;
};
export type AcceptanceDraft = {
  note: string;
  result: "pass" | "fail" | "insufficient";
  sequence: number;
  round: number;
  author: string;
  savedAt: string;
  dueAt?: string;
};
export type Remedy = Base & {
  origin?: Distribution["source"] | "appeal";
  supervisorComment?: string;
  supplementRequirements?: string;
  findingId: string;
  conclusionSequence: number;
  agentId: string;
  inspector: string;
  status:
    | "pending"
    | "executing"
    | "verification"
    | "response"
    | "supervisor"
    | "done"
    | "terminated";
  supervisorReason?: "approve" | "return" | "adjust";
  adjustmentOrigin?: "pending" | "executing";
  goal: string;
  standard: string;
  standardSequence: number;
  sampleCount: number;
  observation: string;
  dueAt: string;
  originalDueAt: string;
  createdAt: string;
  round: number;
  rounds?: { round: number; standard: string; standardSequence: number; goal: string; sampleCount: number; observation: string; materials: Remedy["materials"]; acceptance?: Remedy["acceptance"]; at: string }[];
  materials: {
    at: string;
    text: string;
    samples: string[];
    attachment?: string;
  }[];
  acceptance?: {
    result: "pass" | "fail" | "insufficient";
    note: string;
    sequence: number;
    round: number;
    at: string;
  };
  acceptanceHistory: NonNullable<Remedy["acceptance"]>[];
  pause?: Pause;
  pauseHistory: {
    start: string;
    end: string;
    duration: number;
    reasons: string[];
  }[];
  firstOverdueAt?: string;
  finishedAt?: string;
  terminationReason?: string;
  sourceChanged?: boolean;
  standards: {
    sequence: number;
    standard: string;
    goal: string;
    note: string;
    at: string;
  }[];
  draft?: string; // Legacy notes are retained as unverified reference.
  acceptanceDraft?: AcceptanceDraft;
  acceptanceDraftHistory?: AcceptanceDraft[];
};
export type Supplement = Base & {
  splitFrom?: string;
  target: string;
  executor: string;
  dueAt: string;
  note: string;
  status: "pending" | "submitted" | "done" | "cancelled";
  cancelledAt?: string;
  cancellationReason?: string;
  reply?: string;
  origin: string;
  trigger: string;
};
export type DetectionCondition = { enabled?: boolean; feature: string; role: string; stage: string; mode: string; count: number; duration: number; windowSeconds: number; stageSeconds: number; middleStartSeconds?: number; middleEndSeconds?: number; speed?: number };
export type Resource = Base & { kind: string; name: string; type: "词库" | "业务知识" | "SOP"; indicator: string; content: string; knowledge?: string; updatedAt: string; sourceFile?: string };
export type Rule = Base & { name: string; indicator: string; description: string; enabled: boolean; resourceId: string; conditions: DetectionCondition[]; updatedAt?: string; businesses?: string[]; severity: "high" | "medium" | "low"; };
// method is retained only for reading legacy policy records; notifications use one destination.
export type Policy = Base & { name: string; ruleIds: string[]; level: "high" | "medium" | "low"; recipients: Role[]; method?: "notification" | "live"; flowId: string; reminderIntervalSeconds?: number; updatedAt: string };
export type FlowTemplate = { id: string; name: string; enabled: boolean; firstNode: "supervisor" | "inspector"; owner: string; returnPath?: string; endPath?: string };
export type DetectionBasis = { ruleId: string; ruleName: string; conditions: DetectionCondition[]; resource: Resource; capturedAt: string };
export type RiskLevel = "high" | "medium" | "low" | "none";
export type DetectionHit = { id: string; eventKey: string; batchId: string; ruleId: string; at: string; evidence: number[]; feature: string; basis?: DetectionBasis; requestedFlowId?: string; policy: { id?: string; name: string; level: Exclude<RiskLevel,"none">; recipients: Role[]; method: "notification" | "live"; flowId: string; reminderIntervalSeconds?: number; inspectorIds?: string[] }; observation?: { role: string; stage: string; count: number; duration: number; atSecond: number; speed?: number; windowSeconds?: number }; legacy?: boolean };
export type CallAlert = Base & { callId: string; problemIds: string[]; level: RiskLevel; status: "pending" | "open" | "closed"; createdAt: string; closedAt?: string; completed: number; highestLevel?: RiskLevel; lastActiveLevel?: RiskLevel; closingLevel?: RiskLevel; closeResult?: "excluded" | "resolved"; history: {at:string;from:string;to:string;reason:string;findingIds?:string[];policyIds?:string[];closeResult?:"excluded"|"resolved"}[] };
export type PlatformSettings = Base & { settingsType: "platform"; displayFields: string[]; updatedAt: string };
export type Log = {
  recipients?: string[];
  changes?: {field:string;before:unknown;after:unknown}[];
  relatedTargets?: string[]; // Shared historical targets after a legacy review split.
  id: string;
  target: string;
  callId?: string;
  at: string;
  actor: string;
  action: string;
  note: string;
  overrun?: {
    requestId: string; operation: string; deadlineLabel: string; deadlineAt: string;
    submittedAt: string; exceededByMs: number; owner: string;
  };
};
export type State = {
  schema: 2;
  reviewSplits?: { source: Review; at: string; parts: { reviewId: string; findingId: string }[] }[];
  revision: number;
  readEvents?: Record<string, string[]>;
  identity: string;
  view: View;
  calls: Call[];
  findings: Finding[];
  reviews: Review[];
  appeals: Appeal[];
  remedies: Remedy[];
  supplements: Supplement[];
  rules: Rule[];
  policies: Policy[];
  archivedPolicies?: Policy[];
  settings?: PlatformSettings;
  notificationDeliveries?: {key:string;at:string;findingId:string;hitId:string;recipient:string;method:string;status:"delivered"|"failed";error?:string}[];
  flows: FlowTemplate[];
  alerts: CallAlert[];
  defaults: {level: "high" | "medium" | "low"; recipients: Role[]};
  resources: Resource[];
  logs: Log[];
  requests: string[];
};
export type Entity =
  | Call
  | Finding
  | Review
  | Appeal
  | Remedy
  | Supplement
  | Rule
  | Resource
  | Policy
  | CallAlert
  | PlatformSettings;
export const latest = (f: Finding) => {const c=f.conclusions.at(-1);return f.reopenedAfterSequence!==undefined&&c&&c.sequence<=f.reopenedAfterSequence?undefined:c;};
export const terminalAppeal = (a: Appeal) =>
  ["done", "withdrawn", "rejected"].includes(a.status);
export const terminalRemedy = (r: Remedy) =>
  ["done", "terminated"].includes(r.status);
export const roleOf = (s: State) => person(s.identity).role;
export const entity = (s: State, id: string): Entity | undefined =>
  [
    ...s.calls,
    ...s.findings,
    ...s.reviews,
    ...s.appeals,
    ...s.remedies,
    ...s.supplements,
    ...s.rules,
    ...s.resources,
    ...s.policies,
    ...s.alerts,
    ...(s.settings ? [s.settings] : []),
  ].find((x) => x.id === id);
export function callFor(s: State, id: string): Call | undefined {
  const e = entity(s, id);
  if (!e) return;
  if ("batches" in e) return e;
  if ("callId" in e) return s.calls.find((c) => c.id === e.callId);
  if ("findingId" in e) return callFor(s, e.findingId);
  if ("target" in e) return callFor(s, e.target);
}
export function canSeeCall(s: State, c: Call) {
  const role = roleOf(s);
  return (
    role === "supervisor" ||
    (role === "agent"
      ? c.agentId === s.identity
      : c.authorized.includes(s.identity) ||
        s.reviews.some((r) => r.callId === c.id && r.owner === s.identity) ||
        s.remedies.some(
          (r) => r.inspector === s.identity && (callFor(s, r.id)?.id === c.id || [...r.materials, ...(r.rounds ?? []).flatMap(round => round.materials)].some(material => material.samples.includes(c.id))),
        ) ||
        s.supplements.some(
          (x) => x.executor === s.identity && callFor(s, x.target)?.id === c.id,
        ))
  );
}
export function canSee(s: State, id: string): boolean {
  const e = entity(s, id);
  if (!e) return false;
  const role = roleOf(s);
  if (role === "supervisor") return true;
  if ("resourceId" in e || "kind" in e || "ruleIds" in e || "settingsType" in e) return role === "inspector";
  const c = callFor(s, id);
  if (!c || !canSeeCall(s, c)) return false;
  if ("type" in e && "findingIds" in e)
    return role === "inspector"
      ? e.owner === s.identity
      : e.status === "done" && e.type !== "appeal";
  if ("findingId" in e && "agentId" in e)
    return role === "agent"
      ? e.agentId === s.identity
      : "inspector" in e
        ? e.inspector === s.identity
        : !!e.reviewId &&
          s.reviews.some((r) => r.id === e.reviewId && r.owner === s.identity);
  if ("target" in e) return e.executor === s.identity || canSee(s, e.target);
  if ("conclusions" in e && role === "agent")
    return !!latest(e) || !!e.reminder;
  return true;
}
export function detection(c: Call) {
  const checks = c.batches.at(-1)?.checks ?? [];
  if (!checks.length || checks.every((x) => x.state === "pending"))
    return "待处理";
  if (checks.some((x) => x.state === "running" || x.state === "pending"))
    return "处理中";
  const failed = checks.filter((x) => x.state === "failed").length;
  return failed === checks.length ? "失败" : failed ? "部分失败" : "已完成";
}
export const statusNames: Record<string, string> = {
  candidate: "待主管初审",
  reminded: "已提醒 · 待衔接",
  supplement: "待补材料",
  review: "人工复核中",
  closed: "误报归档",
  delivered: "结论已送达",
  pending: "待处理",
  working: "复核中",
  supervisor: "待主管处理",
  done: "已办结",
  cancelled: "已取消",
  submitted: "待受理",
  accepted: "已受理",
  reviewing: "核查中",
  decision: "待裁定",
  withdrawn: "已撤回",
  rejected: "不受理",
  executing: "整改中",
  verification: "待质检员核验",
  response: "待质检员核对主管意见",
  terminated: "已终止",
};
export const actionNames: Record<string, string> = {
  dispatch: "直接提醒坐席",
  accept_result: "接受并开始整改",
  assign_inspector: "指定核验质检员",
  optimization_feedback: "记录规则优化反馈",
  agree_remedy_return: "赞同，补充整改要求",
  explain_remedy: "不赞同，向主管补充说明",
  return_appeal: "退回质检员核对",
  agree_appeal_return: "赞同，重新核查",
  explain_appeal: "不赞同，向主管补充说明",
  create_policy: "新增预警策略",
  save_policy: "保存预警策略",
  delete_policy: "删除预警策略",
  toggle_indicator: "切换指标状态",
  request_evidence: "申请补证",
  link_finding: "关联已有问题",
  accept_assign: "受理并分派核查",
  accept_decide: "受理并直接裁定",
  resource_feedback: "提出依据补充意见",
  reassign: "转派任务",
  sample_calls: "生成整改后样例",
  remind: "提醒坐席",
  end_call: "模拟通话结束",
  dismiss: "确认误报并归档",
  assign: "转人工复核",
  supplement: "要求补充材料",
  reply: "提交补充材料",
  receive_supplement: "接收补件并继续",
  extend: "调整期限",
  save_review: "保存复核草稿",
  submit_review: "提交复核意见",
  return_review: "退回复核",
  publish: "确认并分发结果",
  spotcheck: "发起人工抽检",
  add_finding: "登记人工发现",
  ack: "确认知悉",
  feedback_result: "补充结果意见",
  appeal: "不接受，提交申诉",
  withdraw: "撤回申诉",
  accept_appeal: "受理申诉",
  reject_appeal: "不予受理",
  assign_appeal: "分派申诉核查",
  decide: "提交申诉裁定",
  accept_remedy: "接收整改",
  adjust_request: "申请调整要求",
  reject_adjustment: "不同意调整，按原要求继续",
  request_distribution_extension: "申请调整分发期限",
  adjust_distribution: "调整分发期限",
  reject_distribution_extension: "维持原期限",
  material: "提交整改材料",
  save_acceptance: "保存验收草稿",
  verify: "提交验收意见",
  close_remedy: "确认整改结案",
  return_remedy: "退回质检员核对",
  change_standard: "调整目标与标准",
  read_reminder: "标记提醒已读",
  feedback_reminder: "反馈提醒执行",
  dissent_reminder: "提出提醒异议",
  start_detection: "开始检测",
  finish_detection: "完成检测",
  save_resource: "保存资源",
  save_rule_conditions: "保存指标规则",
  followup: "登记补证跟进",
};
// Shared by detail buttons, forms and event history so each stage uses the same wording.
export function actionLabel(s: State, id: string, action: string): string {
  const item = entity(s, id);
  if (item && "standardSequence" in item && item.status === "supervisor" && item.supervisorReason === "adjust") {
    if (action === "change_standard") return "同意调整要求";
    if (action === "extend") return "同意调整期限";
  }
  if (action === "check_rule" || action === "check_resource") return "检查草稿";

  if (item && "conclusionSequence" in item && !("standardSequence" in item) && action === "decide") return "确认申诉裁定";
  if (item && "standardSequence" in item && action === "verify") return "提交核验结果";
  if (item && "standardSequence" in item && action === "close_remedy") return "确认整改完成并归档";
  if (item && "batches" in item && action === "start_detection") return item.batches.length ? "重新检测" : "开始检测";
  if (item && "findingIds" in item) {
    if (action === "publish") {
      if (!item.findingIds.length) return "确认抽检完成";
      const values = item.findingIds.map(fid => item.opinions[fid]?.value);
      if (values.every(value => value === "false_positive")) return "确认结果并归档";
      return "确认结果并分发";
    }
    if (action === "return_review") return item.type === "spotcheck" ? "退回重新抽检" : "退回重新核实";
    if (action === "submit_review") return item.type === "spotcheck" ? "提交抽检结果" : item.type === "appeal" ? "提交申诉核查结果" : "提交核实结果";
    if (action === "supplement" && item.type === "appeal") return "要求补充申诉资料";
    if (action === "supplement" && item.evidenceRequest) return "安排补证";
  }
  return actionNames[action] ?? action;
}
export function actions(s: State, id: string): string[] {
  if (!canSee(s, id)) return [];
  const e = entity(s, id)!,
    role = roleOf(s),
    out: string[] = [];
  if ("batches" in e) {
    if (role === "supervisor") {
      if (e.endedAt && !s.reviews.some(r=>r.callId===id && r.type==="spotcheck" && !r.findingIds.length && !["done","cancelled"].includes(r.status))) out.push("spotcheck");
      if (detection(e) === "处理中") out.push("finish_detection");
      else out.push("start_detection");
      if (!e.endedAt) out.push("end_call");
    }
    return out;
  }
  if ("conclusions" in e) {
    if (role === "supervisor" && !activeAppeal(s, e.id)) {
      if (["candidate", "reminded", "supplement"].includes(e.status)) {
        out.push(...(s.supplements.some(x => x.target === id && openSupplement(x)) ? [] : ["dispatch"]), "dismiss", "assign");
        if(!callFor(s,id)!.endedAt && !e.reminder) out.push("remind");
        // Missing evidence belongs to the assigned review, not a fourth triage route.

      }
      if (e.distribution?.status === "pending") {
        out.push("adjust_distribution");
        if (e.distribution.extensionRequest) out.push("reject_distribution_extension");
      }
      if (latest(e) && e.status === "delivered" && !e.distribution) out.push("followup");
      if (latest(e)?.value === "false_positive" && e.source === "auto") out.push("optimization_feedback");
    }
    if (role === "agent") {
      if (e.reminder) {
        if (!e.reminder.readAt) out.push("read_reminder");
        out.push("feedback_reminder", "dissent_reminder");
      }
      const c = latest(e);
      if (c) {
        if (e.distribution?.status === "pending") out.push("accept_result", ...(!e.distribution.extensionRequest ? ["request_distribution_extension"] : []));
        if (e.seenSequence !== c.sequence) out.push("ack");
        out.push("feedback_result");
        if (
          c.value === "risk" && (!e.distribution || e.distribution.status === "pending") &&
          !s.appeals.some(
            (a) =>
              a.findingId === id &&
              a.conclusionSequence === c.sequence &&
              (!terminalAppeal(a) || a.status === "done"),
          )
        )
          out.push("appeal");
      }
    }
  }
  if ("findingIds" in e) {
    if (e.findingIds.length > 1 || (!e.findingIds.length && e.type !== "spotcheck")) return [];
    if (e.appealId) {
      const ap = s.appeals.find((a) => a.id === e.appealId);
      if (!ap || terminalAppeal(ap) || ap.status === "supplement") return [];
    }
    const awaiting = s.supplements.some(
      (x) => x.target === e.id && openSupplement(x),
    );
    if (
      role === "inspector" &&
      e.owner === s.identity &&
      ["pending", "working"].includes(e.status) && !awaiting && !e.evidenceRequest
    ) {
      out.push("save_review");
      if (callFor(s, id)?.endedAt) out.push("submit_review");
      out.push(e.type === "appeal" ? "supplement" : "request_evidence");
      if (e.type === "spotcheck" && !e.findingIds.length) {
        out.push("add_finding");
        if (linkableFindings(s, e).length) out.push("link_finding");
      }
    }
    if (role === "inspector" && e.owner === s.identity && e.status === "response" && e.type === "appeal") out.push("agree_appeal_return", "explain_appeal");
    if (role === "supervisor" && e.status === "supervisor" && !awaiting)
      out.push(
        ...(e.type === "appeal" || e.evidenceRequest || !callFor(s,id)?.endedAt || (e.findingIds.length ? e.findingIds.some(fid => !["risk", "false_positive"].includes(e.opinions[fid]?.value)) : e.scopeResult !== "clear" || !e.summary?.trim()) ? [] : ["publish"]),
        ...(e.type === "appeal" ? [] : e.evidenceRequest ? ["supplement", "return_review"] : ["return_review"]),
      );
    if (role === "supervisor" && ["pending", "working", "response"].includes(e.status))
      out.push("extend", "reassign");
  }
  if (
    ("conclusionSequence" in e && "reviewId" in e) ||
    s.appeals.includes(e as Appeal)
  ) {
    const a = e as Appeal;
    if (role === "agent" && !terminalAppeal(a)) out.push("withdraw");
    if (role === "supervisor" && !terminalAppeal(a)) {
      if (a.status === "submitted") out.push("accept_assign", "accept_appeal", ...(!s.findings.find(f=>f.id===a.findingId)?.distribution ? ["accept_decide", "reject_appeal"] : []));
      if (a.status === "decision" || a.status === "accepted" && !s.findings.find(f=>f.id===a.findingId)?.distribution) out.push("decide");
      if (a.status === "decision" && a.reviewId) out.push("return_appeal");
      if (a.status === "accepted" && !a.reviewId) out.push("assign_appeal");
      // New-flow appeal evidence is requested by the assigned inspector, never during adjudication.
      if (!s.findings.find(f => f.id === a.findingId)?.distribution && ["submitted", "accepted", "reviewing"].includes(a.status)) out.push("supplement");
      if (a.status !== "decision") out.push("extend");
    }
  }
  if ("standardSequence" in e && !terminalRemedy(e)) {
    if (role === "agent") {
      if (e.status === "executing" || e.pause || s.supplements.some(sp => sp.target === id && sp.executor === s.identity && sp.status === "pending")) out.push("sample_calls");
      if (e.status === "pending" && !e.pause) out.push("accept_remedy");
      if (["pending", "executing"].includes(e.status) && !e.pause)
        out.push("adjust_request");
      if (e.status === "executing" || e.pause) out.push("material");
    }
    if (
      role === "inspector" &&
      e.inspector === s.identity &&
      e.status === "verification"
    ) {
      out.push("save_acceptance");
      if (!e.pause && !s.supplements.some(x => x.target === id && openSupplement(x))) out.push("verify");
    }
    if (role === "inspector" && e.inspector === s.identity && e.status === "response" && !e.pause) out.push("agree_remedy_return", "explain_remedy");
    if (role === "supervisor") {
      if (!e.pause && (e.status !== "supervisor" && e.status !== "response" || e.supervisorReason === "adjust"))
        out.push("change_standard", "extend", ...(e.inspector ? ["reassign"] : e.origin === "direct" ? ["assign_inspector"] : []));
      if (e.status === "supervisor" && !e.pause) {
        if (e.supervisorReason === "adjust") out.push("reject_adjustment");
        if (
          e.supervisorReason === "approve" &&
          e.acceptance?.result === "pass" &&
          e.acceptance.sequence === e.standardSequence && e.acceptance.round === e.round &&
          !s.supplements.some((x) => x.target === id && openSupplement(x))
        )
          out.push("close_remedy");
        if (e.supervisorReason === "approve" && e.acceptance?.result === "pass" && e.inspector) out.push("return_remedy");
      }
    }
  }
  if ("executor" in e) {
    const parent = s.remedies.find(r => r.id === e.target);
    const target = entity(s, e.target);
    if (parent && terminalRemedy(parent) || target && "status" in target && ["done", "cancelled", "closed", "terminated", "withdrawn", "rejected"].includes(target.status)) return [];
    if (e.executor === s.identity && e.status === "pending") out.push("reply");
    if (
      e.status === "submitted" && !parent?.pause &&
      (s.remedies.some((r) => r.id === e.target)
        ? s.remedies.some((r) => r.id === e.target && r.inspector === s.identity)
        : s.appeals.some(ap=>ap.id===e.target && ap.reviewId) ? s.reviews.some(r=>r.appealId===e.target && r.owner===s.identity && !["done","cancelled"].includes(r.status)) : role === "supervisor")
    )
      out.push("receive_supplement");
  }
  if (role === "supervisor") {
    if ("resourceId" in e) {out.push("toggle_indicator", "create_policy");if(supportsWarning(e.indicator))out.push("save_rule_conditions");}
    if ("kind" in e) out.push("save_resource");
    if ("settingsType" in e) out.push("save_settings");
    if ("ruleIds" in e) out.push("save_policy", "create_policy", "delete_policy");
  }
  return [...new Set(out)];
}
export function linkableFindings(s: State, review: Review) {
  if (review.type !== "spotcheck" || review.findingIds.length) return [];
  return s.findings.filter(f => f.callId === review.callId && !latest(f) && ["candidate", "reminded"].includes(f.status) && canSee(s, f.id) && !review.findingIds.includes(f.id) && !activeAppeal(s, f.id) && !s.reviews.some(other => other.id !== review.id && other.findingIds.includes(f.id) && !["done", "cancelled"].includes(other.status)));
}

// Legacy commands remain available to migrations; product entry points share this list.
export function contextActions(s: State, id: string): string[] {
  const hidden = ["start_detection", "finish_detection", "remind", "sample_calls", "accept_appeal", "accept_decide", "reject_appeal", "followup", "feedback_result", "save_review", "save_acceptance"];
  const item = entity(s, id);
  return actions(s, id).filter(action => !hidden.includes(action) && !(action === "supplement" && item && !("findingIds" in item)) && !(action === "decide" && item && "findingId" in item && !("standardSequence" in item) && !item.reviewId));
}

export type Input = {
  settings?: Omit<PlatformSettings,"id"|"rev"|"settingsType"|"updatedAt">;
  policy?: Omit<Policy,"id"|"rev"|"updatedAt">;
  conditions?: DetectionCondition[];
  knowledge?: string;
  ruleResources?: Record<string,number>;
  triggerRules?: string[];
  config?: Record<string,string>;
  resourceKind?: string;
  sourceFile?: string;
  referenceRevs?: Record<string, number>;
  findingId?: string;
  dispositions?: Record<string, { remedy: boolean; noRemedy?: string; goal?: string; standard?: string; owner?: string; dueAt?: string; responseDueAt?: string; sampleCount?: number; observation?: string }>;
  refs?: string[];
  resourceType?: Resource["type"];
  note?: string;
  owner?: string;
  dueAt?: string;
  responseDueAt?: string;
  value?: string;
  evidence?: number[];
  opinions?: Record<string, Opinion>;
  summary?: string;
  title?: string;
  ruleId?: string;
  goal?: string;
  standard?: string;
  sampleCount?: number;
  observation?: string;
  remedy?: boolean;
  noRemedy?: string;
  samples?: string[];
  attachment?: string;
  trigger?: string;
  scope?: string;
  threshold?: number;
  content?: string;
  resourceRole?: string;
  exception?: string;
  checkPass?: boolean;
  draftBasisConfirmed?: boolean;
};
export type Command = {
  id: string;
  action: string;
  rev: number;
  requestId: string;
  input: Input;
};
function must(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const future = (s: string | undefined, now: Date) =>
  s && Number.isFinite(Date.parse(s)) && Date.parse(s) > now.getTime();
const validInspector = (id?: string) =>
  people.some((p) => p.id === id && p.role === "inspector");
export const currentOwner = (s: State, e: Entity): string => {
  "use strict";
  if ("conclusions" in e) {
    if (["candidate", "reminded", "supplement"].includes(e.status))
      return "S01";
    if (e.status === "review") {
      const r = s.reviews.find(
        (r) =>
          r.findingIds.includes(e.id) &&
          r.type !== "appeal" &&
          !["done", "cancelled"].includes(r.status),
      );
      return r ? (r.status === "supervisor" ? "S01" : r.owner) : "";
    }
    return e.distribution?.status === "pending" ? callFor(s,e.id)!.agentId : "";
  }
  if ("findingIds" in e) {
    const ap=s.appeals.find(a=>a.id===e.appealId);
    if(ap?.status==="supplement" && !["done","cancelled"].includes(e.status))return currentOwner(s,ap);
    const supplement=s.supplements.find(sp=>sp.target===e.id&&openSupplement(sp));
    if(supplement && !["done","cancelled"].includes(e.status))return currentOwner(s,supplement);
    return ["done", "cancelled"].includes(e.status)
      ? ""
      : e.status === "supervisor" || e.evidenceRequest
        ? "S01"
        : e.owner;
  }
  if ("standardSequence" in e)
    return terminalRemedy(e)
      ? ""
      : e.status === "verification" || e.status === "response"
        ? e.inspector || "S01"
        : e.status === "supervisor"
          ? "S01"
          : e.agentId;
  if ("findingId" in e)
    return terminalAppeal(e)
      ? ""
      : e.status === "supplement"
        ? (s.supplements.find(sp => sp.target === e.id && openSupplement(sp))?.status === "submitted" ? s.reviews.find(r=>r.id===e.reviewId)?.owner ?? "S01" : e.agentId)
        : e.status === "reviewing"
          ? (s.reviews.find((r) => r.id === e.reviewId)?.owner ?? "S01")
          : "S01";
  if ("executor" in e)
    return s.remedies.some(r => r.id === e.target && terminalRemedy(r)) ? "" : e.status === "pending"
      ? e.executor
      : e.status === "submitted"
        ? (s.remedies.find((r) => r.id === e.target)?.inspector || s.reviews.find(r=>r.id===s.appeals.find(ap=>ap.id===e.target)?.reviewId)?.owner || "S01")
        : "";
  return "";
};
export function pauseRemedy(r: Remedy, reason: string, now: Date) {
  if (terminalRemedy(r)) return;
  if (r.pause) {
    if (!r.pause.reasons.includes(reason)) r.pause.reasons.push(reason);
    return;
  }
  const overdue = Date.parse(r.dueAt) < now.getTime();
  if (overdue) r.firstOverdueAt ??= r.dueAt;
  r.pause = {
    reasons: [reason],
    startedAt: now.toISOString(),
    phase: r.status,
    owner:
      r.status === "verification"
        ? r.inspector
        : r.status === "supervisor"
          ? "S01"
          : r.agentId,
    dueAt: r.dueAt,
    wasOverdue: overdue,
  };
  r.rev++;
}
export function resumeRemedy(r: Remedy, reason: string, now: Date) {
  if (!r.pause) return;
  const reasons = [...r.pause.reasons];
  r.pause.reasons = r.pause.reasons.filter((x) => x !== reason);
  if (r.pause.reasons.length) return;
  const elapsed = Math.max(0, now.getTime() - Date.parse(r.pause.startedAt));
  const previousDue = r.dueAt;
  r.dueAt = new Date(Date.parse(r.dueAt) + elapsed).toISOString();
  if(r.dueAt !== previousDue) (r.deadlineChanges ??= []).push({from:previousDue,to:r.dueAt,at:now.toISOString(),reason:"申诉暂停恢复，顺延实际暂停时长"});
  r.pauseHistory.push({
    start: r.pause.startedAt,
    end: now.toISOString(),
    duration: elapsed,
    reasons,
  });
  r.pause = undefined;
  r.rev++;
}
export const openSupplement = (sp: Supplement) => sp.status === "pending" || sp.status === "submitted";
function cancelRemedySupplements(s: State, r: Remedy, at: string) {
  for (const sp of s.supplements.filter(x => x.target === r.id && openSupplement(x))) {
    sp.status = "cancelled";
    sp.cancelledAt = at;
    sp.cancellationReason = r.terminationReason || "关联整改已结束";
    sp.rev++;
  }
}
function terminateRemedy(s: State, r: Remedy, reason: string, now: Date) {
  if (r.pause) for (const id of [...r.pause.reasons]) resumeRemedy(r, id, now);
  r.status = "terminated";
  r.terminationReason = reason;
  r.finishedAt = now.toISOString();
  cancelRemedySupplements(s, r, r.finishedAt);
}
export function restoreLifecycle(s: State) {
  for (const r of s.remedies.filter(terminalRemedy))
    cancelRemedySupplements(s, r, r.finishedAt || s.logs.at(-1)?.at || r.createdAt);
  return s;
}
export function acceptanceDraftMatches(r: Remedy, identity: string) {
  const d = r.acceptanceDraft;
  return !!d && d.sequence === r.standardSequence && d.round === r.round && d.author === identity;
}
// A supplement executor may see their task without access to internal review opinions.
export function standaloneSupplements(s: State) {
  return s.supplements.filter(sp => canSee(s, sp.id) && !canSee(s, sp.target));
}
export function visibleTaskTarget(s: State, id: string) {
  const item = entity(s, id);
  if (item && "executor" in item && canSee(s, item.target)) return visibleTaskTarget(s, item.target);
  if (item && "conclusions" in item && item.source === "manual" && latest(item)?.value === "false_positive") {
    const appeal = s.appeals.findLast(a => a.findingId === id && canSee(s, a.id));
    const review = s.reviews.findLast(r => r.findingIds.includes(id) && canSee(s, r.id));
    return appeal?.id ?? review?.id ?? item.callId;
  }
  return id;
}
export function agentWorkItems(s: State): Entity[] {
  return [...s.findings.filter(f => canSee(s, f.id) && (!!latest(f) || !!f.reminder)), ...standaloneSupplements(s)];
}
function cancelAppealReview(s: State, a: Appeal, now: Date, completed = false) {
  const r = s.reviews.find((r) => r.id === a.reviewId);
  if (r && !["done", "cancelled"].includes(r.status)) {
    r.history.push({
      at: now.toISOString(),
      opinions: structuredClone(r.opinions),
      summary: r.summary,
    });
    r.status =
      completed &&
      r.status === "supervisor" &&
      r.findingIds.every((id) => r.opinions[id])
        ? "done"
        : "cancelled";
    if (r.status === "done") r.finishedAt = now.toISOString();
    r.rev++;
  }
  for (const x of s.supplements.filter(
    (x) => x.target === a.id && openSupplement(x),
  )) {
    x.status = "done";
    x.rev++;
  }
}
export function apply(state: State, cmd: Command, now = new Date()): State {
  if (state.requests.includes(cmd.requestId)) return state;
  if (["toggle_indicator", "save_resource", "save_rule_conditions", "save_policy", "create_policy", "delete_policy", "save_settings"].includes(cmd.action)) return applyConfiguration(state,cmd,now);
  if (["review_new_evidence","confirm_detection","resolve_flow_conflict"].includes(cmd.action)) return applyAlertCommand(state,cmd,now);
  const old = entity(state, cmd.id);
  must(old, "对象不存在");
  if ("findingIds" in old) must(old.findingIds.length <= 1 && (old.findingIds.length === 1 || old.type === "spotcheck"), "一张复核工单只能处理一个问题，请刷新页面完成旧工单拆分。");
  must(old.rev === cmd.rev, "记录已更新，请关闭旧表单后重新操作。");
  must(
    actions(state, cmd.id).includes(cmd.action),
    "当前身份或状态不允许此操作。",
  );
  if (["accept_assign", "accept_decide"].includes(cmd.action)) {
    let next = apply(state, {...cmd, action: "accept_appeal", requestId: cmd.requestId + ":accept"}, now);
    next = apply(next, {...cmd, action: cmd.action === "accept_assign" ? "assign_appeal" : "decide", rev: entity(next,cmd.id)!.rev, requestId: cmd.requestId + ":next"}, now);
    next.requests.push(cmd.requestId);
    return next;
  }
  const s = structuredClone(state),
    e = entity(s, cmd.id)!,
    i = cmd.input,
    a = cmd.action,
    at = now.toISOString(),
    role = roleOf(s);
  const free = [
    "save_review",
    "submit_review",
    "publish",
    "sample_calls",
    "end_call",
    "read_reminder",
    "ack",
    "accept_remedy",
    "accept_result",
    "check_rule",
    "check_resource",
    "discard_rule",
    "discard_resource",
    "start_detection",
    "finish_detection",
  ];
  if (!free.includes(a))
    must((i.note ?? "").trim().length >= 4, "请填写至少 4 个字的处理说明。");
  for (const task of [...s.reviews, ...s.appeals, ...s.remedies]) {
    if (Date.parse(task.dueAt) < now.getTime() && !["done","cancelled","terminated","withdrawn","rejected"].includes(task.status) && !("pause" in task && task.pause)) task.firstOverdueAt ??= task.dueAt;
  }
  for (const f of s.findings.filter(f => f.id === e.id)) {
    const d = f.distribution;
    if (d?.status !== "pending") continue;
    if (d.responseDueAt && Date.parse(d.responseDueAt) <= now.getTime()) d.responseOverdueAt ??= d.responseDueAt;
    if (Date.parse(d.dueAt) <= now.getTime()) d.completionOverdueAt ??= d.dueAt;
  }
  const due = () => {
    must(!!i.dueAt && Number.isFinite(Date.parse(i.dueAt)), "请选择有效的办理期限。");
    const retained = retainedWarningDeadline(s, e, a, now.getTime());
    // The picker edits minutes; restore the exact recorded timestamp without moving its clock.
    const keepsExpired = !!retained && Math.floor(Date.parse(i.dueAt!) / 60000) === Math.floor(Date.parse(retained) / 60000);
    must(keepsExpired || future(i.dueAt, now), "请选择晚于当前时间的期限；超时办理可保留原截止时间提交。");
    const limit = taskDeadlineLimit(s, e);
    must(keepsExpired || !limit || Date.parse(i.dueAt!) <= Date.parse(limit), "办理期限超过上级处置期限（含主管预留时间）；超时办理请保留原截止时间提交，不会重置总期限。");
    if (s.appeals.some(ap => ap.id === e.id)) {
      const child = s.reviews.find(r => r.appealId === e.id && !["done", "cancelled"].includes(r.status));
      if (a === "extend" && child) must(Date.parse(child.dueAt) <= Date.parse(i.dueAt!), "申诉截止不能早于未完成的核查期限，请先调整核查期限。");
    }
    return keepsExpired ? retained! : i.dueAt!;
  };
  const inspector = () => {
    must(validInspector(i.owner), "请选择有效质检员。");
    return i.owner!;
  };
  const evidence = (callId: string) => {
    must(
      i.evidence?.length &&
        i.evidence.every(
          (n) => s.calls.find((c) => c.id === callId)!.transcript[n],
        ),
      "请选择有效证据片段。",
    );
    return i.evidence!;
  };
  const uid = (prefix: string) =>
    `${prefix}-${s.revision + 1}-${s.logs.length + 1}`;
  const addReview = (
    f: Finding,
    owner: string,
    dueAt: string,
    type: Review["type"] = "candidate",
    appealId?: string,
  ) => {
    const existing = s.reviews.find(
      (r) =>
        r.findingIds.includes(f.id) &&
        r.type === type &&
        !["done", "cancelled"].includes(r.status),
    );
    if (existing) return existing;
    const r: Review = {
      id: uid("WO"),
      rev: 0,
      callId: f.callId,
      findingIds: [f.id],
      type,
      scope: i.note?.trim() || "通话结束后核查提醒风险",
      owner,
      dueAt,
      originalDueAt: dueAt,
      status: "pending",
      opinions: {},
      history: [],
      ...(appealId ? { appealId } : {}),
    };
    s.reviews.push(r);
    if (type !== "appeal") {
      f.status = "review";
      f.rev++;
    }
    return r;
  };
  const conclude = (
    f: Finding,
    value: Verdict,
    note: string,
    reviewer?: string,
    noRemedy?: string,
    selectedEvidence: number[] = i.evidence ?? f.evidence,
  ) => {
    must(!activeAppeal(s,f.id) || a === "decide", "请在进行中的申诉内处理新证据和结论");
    must(selectedEvidence.length && selectedEvidence.every(n => s.calls.find(c => c.id === f.callId)!.transcript[n]), "结论必须引用有效证据");
    if (a !== "decide" && latest(f)) {
      for (const r of s.remedies.filter(r => r.findingId === f.id)) {
        r.sourceChanged = true;
        if (!terminalRemedy(r)) {
          terminateRemedy(s, r, value === "insufficient" ? "新证据不足，旧整改依据不充分" : value === "false_positive" ? "补充核查改判为误报" : "来源结论更新，按新结论另行处置", now);
        }
        r.rev++;
      }
    }
    f.distribution = undefined;
    f.conclusions.push({
      sequence: (f.conclusions.at(-1)?.sequence ?? 0) + 1,
      value,
      note,
      at,
      by: s.identity,
      reviewer,
      noRemedy,
      evidence: [...selectedEvidence], batchId: f.batchId,
    });
    f.status = value === "false_positive" ? "closed" : "delivered";
    if (value === "false_positive" && f.source === "auto") f.optimization = {status:"pending",note,by:s.identity,at};
    f.rev++;
  };
  const distribution = (f: Finding, d: Partial<Distribution>, source: Distribution["source"], owner: string) => {
    must(d.goal?.trim() && d.standard?.trim() && d.observation?.trim(), "请补齐整改目标、标准与资料要求");
    must(Number.isInteger(d.sampleCount) && d.sampleCount! >= 1 && d.sampleCount! <= 20, "样例数量须为 1–20");
    must(future(d.dueAt,now), "请选择晚于当前时间的整改期限");
    must(source === "direct" || validInspector(owner), "复核或抽检结果必须沿用经办质检员");
    const responseDueAt = d.responseDueAt ?? new Date(Math.min(now.getTime() + 4 * 3600000, Date.parse(d.dueAt!))).toISOString();
    must(future(responseDueAt,now) && Date.parse(responseDueAt) <= Date.parse(d.dueAt!), "回应期限须晚于当前时间，且不晚于整改完成期限");
    f.distribution = {source,sequence:latest(f)!.sequence,status:"pending",goal:d.goal!,standard:d.standard!,observation:d.observation!,sampleCount:d.sampleCount!,dueAt:d.dueAt!,originalDueAt:d.dueAt!,responseDueAt,originalResponseDueAt:responseDueAt,inspector:owner,at};
  };
  const createRemedy = (f: Finding, owner?: string, origin?: Remedy["origin"]) => {
    const d=f.distribution;
    must(d && d.sequence===latest(f)?.sequence, "缺少当前结论的整改要求，请联系主管补充分发");
    must(!s.remedies.some(r=>r.findingId===f.id && r.conclusionSequence===d.sequence && !terminalRemedy(r)), "本结论已有整改任务");
    const assigned=owner ?? d.inspector;
    must(validInspector(assigned) || d.source==="direct" && !owner, "此来源必须沿用已记录的质检员");
    s.remedies.push({id:`${uid("REC")}-${f.id}`,rev:0,findingId:f.id,conclusionSequence:d.sequence,agentId:callFor(s,f.id)!.agentId,inspector:assigned,origin:origin ?? d.source,status:"executing",goal:d.goal,standard:d.standard,standardSequence:1,sampleCount:d.sampleCount,observation:d.observation,dueAt:d.dueAt,originalDueAt:d.originalDueAt ?? d.dueAt,firstOverdueAt:d.completionOverdueAt,createdAt:at,round:1,materials:[],acceptanceHistory:[],pauseHistory:[],standards:[{sequence:1,goal:d.goal,standard:d.standard,note:"按已分发要求进入整改",at}]});
    d.status="accepted";f.seenSequence=d.sequence;f.rev++;
  };
  const returnToAgent = (r: Remedy) => {
    (r.rounds ??= []).push({round:r.round,standard:r.standard,standardSequence:r.standardSequence,goal:r.goal,sampleCount:r.sampleCount,observation:r.observation,materials:structuredClone(r.materials),acceptance:structuredClone(r.acceptance),at});
    r.round++;r.status="executing";r.materials=[];r.acceptance=undefined;r.supervisorReason=undefined;r.supplementRequirements=i.note;
  };
  if (a === "request_distribution_extension") {
    const d = (e as Finding).distribution!;
    d.extensionRequest = {note:i.note!,at};
  }
  if (a === "reject_distribution_extension") delete (e as Finding).distribution!.extensionRequest;
  if (a === "adjust_distribution") {
    const d = (e as Finding).distribution!;
    must(future(i.dueAt,now), "完成期限须晚于当前时间");
    const responseDueAt = i.responseDueAt ?? d.responseDueAt;
    must(responseDueAt && (responseDueAt === d.responseDueAt || future(responseDueAt,now)) && Date.parse(responseDueAt) <= Date.parse(i.dueAt!), "回应期限须在完成期限之内；新回应期限须晚于当前时间");
    d.originalDueAt ??= d.dueAt; d.originalResponseDueAt ??= d.responseDueAt;
    (d.deadlineHistory ??= []).push({at,dueAt:d.dueAt,responseDueAt:d.responseDueAt,note:i.note!});
    d.dueAt = i.dueAt!; d.responseDueAt = responseDueAt; delete d.extensionRequest;
  }
  if(a==="dispatch") { const f=e as Finding; conclude(f,"risk",i.note!,undefined,undefined,evidence(f.callId));distribution(f,i,"direct",""); }
  if(a==="accept_result") createRemedy(e as Finding);
  if(a==="assign_inspector") {
    const r=e as Remedy;
    must(r.origin==="direct" && !r.inspector,"仅直接提醒且直接接受整改需要补派质检员");
    r.inspector=inspector();
    const f=s.findings.find(f=>f.id===r.findingId);
    if(f?.distribution?.sequence===r.conclusionSequence) {f.distribution.inspector=r.inspector;f.rev++;}
  }
  if(a==="optimization_feedback") {must(["pending","recorded","unnecessary"].includes(i.value ?? ""),"请选择优化反馈状态");(e as Finding).optimization={status:i.value as "pending"|"recorded"|"unnecessary",note:i.note!,by:s.identity,at};}
  const addSupplement = (target: string, executor: string, origin: string) => {
    must(
      !s.supplements.some((x) => x.target === target && openSupplement(x)),
      "已有补件在处理中。",
    );
    must(supplementExecutors(s,target).some(p=>p.id === executor), "补件执行人无此通话范围，请重新选择");
    s.supplements.push({
      id: uid("SUP"),
      rev: 0,
      target,
      executor,
      dueAt: due(),
      note: i.note!,
      status: "pending",
      origin,
      trigger: i.trigger || "提交后由当前责任人重新核对",
    });
  };
  if (a === "end_call") {
    const c = e as Call;
    must(!c.endedAt, "通话已结束");
    c.endedAt = at;
    for (const f of s.findings.filter(
      (f) =>
        f.callId === c.id &&
        f.reminder &&
        ["candidate", "reminded"].includes(f.status),
    )) {
      if (
        f.assignment &&
        validInspector(f.assignment.owner) &&
        future(f.assignment.dueAt, now)
      )
        addReview(f, f.assignment.owner, f.assignment.dueAt);
      else {
        f.status = "candidate";
        f.rev++;
      }
    }
  }
  if (a === "remind") {
    const f = e as Finding;
    must(!callFor(s, f.id)!.endedAt, "通话已结束");
    f.reminder = { text: i.note!, sentAt: at };
    f.status = "reminded";
    if (i.owner) f.assignment = { owner: inspector(), dueAt: due() };
  }
  if (["read_reminder", "feedback_reminder", "dissent_reminder"].includes(a)) {
    const f = e as Finding;
    must(f.reminder, "提醒不存在");
    if (a === "read_reminder") f.reminder.readAt = at;
    if (a === "feedback_reminder") f.reminder.feedback = i.note;
    if (a === "dissent_reminder") f.reminder.dissent = i.note;
  }
  if (a === "ack") (e as Finding).seenSequence = latest(e as Finding)!.sequence;
  if (a === "dismiss") {
    const f = e as Finding;
    must(
      i.value === "false_positive",
      "仅确认误报才能关闭归档；材料不足请转人工核实或补件",
    );
    evidence(f.callId);
    conclude(f, i.value as Verdict, i.note!);
    f.status = "closed";
    s.supplements
      .filter((x) => x.target === f.id)
      .forEach((x) => {
        x.status = "done";
        x.rev++;
      });
  }
  if (a === "assign") {
    const f = e as Finding;
    addReview(f, inspector(), due());
    s.supplements
      .filter((x) => x.target === f.id)
      .forEach((x) => {
        x.status = "done";
        x.rev++;
      });
  }
  if (a === "followup") {
    const f = e as Finding;
    f.status = "supplement";
    addSupplement(f.id, i.owner || "S01", "followup");
  }
  if (a === "request_evidence") {
    const r = e as Review;
    r.evidenceRequest = {note: i.note!, at};
    r.status = "supervisor";
  }
  if (a === "link_finding") {
    const r = e as Review;
    must(r.type === "spotcheck" && !r.findingIds.length, "工单已关联问题，请为其他问题另建工单");
    const f = s.findings.find(f=>f.id === i.findingId);
    must(f && f.callId === r.callId && canSee(s,f.id), "请选择同通话的已有问题");
    must(!r.findingIds.includes(f.id), "该问题已经关联");
    must(!latest(f) && ["candidate", "reminded"].includes(f.status), "已形成结论或正在核实的问题不能重新关联抽检");
    must(!activeAppeal(s,f.id), "该问题申诉处理中，请在申诉内补充证据");
    must(!s.reviews.some(x=>x.id!==r.id && x.findingIds.includes(f.id) && !["done","cancelled"].includes(x.status)), "已有复核在处理中，请进入原工单");
    r.findingIds.push(f.id); f.status="review"; f.rev++;
  }
  if (a === "spotcheck") {
    const c = e as Call;
    must(i.scope?.trim(), "请填写抽查范围");
    const deadline = due();
    s.reviews.push({
      id: uid("WO"),
      rev: 0,
      callId: c.id,
      findingIds: [],
      type: "spotcheck",
      scope: i.scope!,
      owner: inspector(),
      dueAt: deadline,
      originalDueAt: deadline,
      status: "pending",
      opinions: {},
      history: [],
    });
  }
  if (a === "add_finding") {
    const r = e as Review;
    must(r.type === "spotcheck" && !r.findingIds.length, "工单已关联问题，请为其他问题另建工单");
    must(i.title?.trim() && i.ruleId, "请填写问题标题并选择规则");
    must(
      !s.findings.some(
        (f) => f.callId === r.callId && f.title.trim() === i.title!.trim(),
      ),
      "同一事实已存在，请关联已有问题。",
    );
    const rule = s.rules.find((x) => x.id === i.ruleId);
    must(rule && rule.enabled, "请选择当前有效的指标规则");
    const f: Finding = {
      id: uid("F"),
      rev: 0,
      callId: r.callId,
      title: i.title!,
      ruleId: rule.id,
      basis: captureBasis(s,rule,at),
      batchId: "manual",
      indicator: rule.indicator,
      related: [],
      source: "manual",
      severity: rule.severity,
      evidence: evidence(r.callId),
      status: "review",
      conclusions: [],
    };
    s.findings.push(f);
    r.findingIds.push(f.id);
  }
  if (a === "save_review" || a === "submit_review") {
    const r = e as Review;
    const opinions = i.opinions ?? {};
    must(Object.keys(opinions).every(id => r.findingIds.includes(id)), "只能保存当前工单对应问题的复核意见");
    if (a === "submit_review") {
      must(callFor(s,r.id)?.endedAt, "通话结束后才能提交正式复核");
      for (const id of r.findingIds) {
        const op = opinions[id];
        must(
          op &&
            ["risk", "false_positive"].includes(op.value) &&
            op.note.trim().length >= 4 &&
            op.evidence.length &&
            op.evidence.every(
              (n) => s.calls.find((c) => c.id === r.callId)!.transcript[n],
            ),
          "请填写当前问题的判断、说明和有效证据",
        );
      }
      if (!r.findingIds.length) {
        must(
          i.value === "clear" && !!(i.summary || i.note)?.trim(),
          "请确认抽检未发现问题并填写范围核验说明；材料不足请申请补证",
        );
        r.scopeResult = i.value as "clear" | "insufficient";
      }
      r.status = "supervisor";
      if (r.appealId) {
        const ap = s.appeals.find((x) => x.id === r.appealId)!;
        must(
          !terminalAppeal(ap) && ap.status === "reviewing",
          "关联申诉已变化",
        );
        ap.status = "decision";
        ap.rev++;
      }
    } else r.status = "working";
    r.opinions = opinions;
    r.summary = i.summary || i.note;
    r.history.push({
      at,
      opinions: structuredClone(opinions),
      summary: r.summary,
    });
  }
  if (a === "return_review") {
    const r = e as Review;
    r.supervisorComment = i.note;
    r.status = "working";
    r.evidenceRequest = undefined;
    r.dueAt = due();
    if (r.appealId) {
      const ap = s.appeals.find((x) => x.id === r.appealId)!;
      ap.status = "reviewing";
      ap.rev++;
    }
  }
  if (a === "publish") {
    const r = e as Review;
    must(r.type !== "appeal", "申诉核查须在申诉案件裁定");
    must([...Object.keys(i.opinions ?? {}), ...Object.keys(i.dispositions ?? {})].every(id => r.findingIds.includes(id)), "只能确认当前工单对应问题的处理结果");
    must(callFor(s,r.id)?.endedAt, "通话结束后才能确认正式结论");
    if(!r.findingIds.length) must(r.scopeResult === "clear" && !!r.summary?.trim(),"请先由质检员提交未发现问题的范围核验说明");
    for (const id of r.findingIds) {
      const disposition = i.dispositions?.[id] ?? i;
      const f = s.findings.find((f) => f.id === id)!,
        op = r.opinions[id];
      must(!i.opinions?.[id] || i.opinions[id].value === op?.value,
        "不认可核实结论时，请退回质检员重新核实");
      must(
        op &&
          op.note.trim().length >= 4 &&
          op.evidence.length &&
          op.evidence.every(
            (n) => s.calls.find((c) => c.id === r.callId)!.transcript[n],
          ),
        "当前问题须保留有效结论说明与证据",
      );
      must(
        ["risk", "false_positive"].includes(op.value),
        "结论无效",
      );
      conclude(f,op.value,op.note || i.note!,r.owner,undefined,op.evidence);
      if (op.value === "risk") distribution(f,disposition,r.type === "spotcheck" ? "spotcheck" : "review",r.owner);
    }
    r.status = "done";
    r.finishedAt = at;
  }
  if (a === "appeal") {
    const f = e as Finding,
      c = latest(f)!;
    evidence(f.callId);
    const ap: Appeal = {
      id: uid("AP"),
      rev: 0,
      findingId: f.id,
      conclusionSequence: c.sequence,
      agentId: callFor(s, f.id)!.agentId,
      status: "submitted",
      note: i.note!,
      evidence: i.evidence!,
      dueAt: new Date(now.getTime() + 86400000).toISOString(),
      originalDueAt: new Date(now.getTime() + 86400000).toISOString(),
    };
    s.appeals.push(ap);
    if(f.distribution) {f.distribution.status="appealed";f.distribution.respondedAt=at;f.seenSequence=c.sequence;}
    s.remedies
      .filter((r) => r.findingId === f.id && !terminalRemedy(r))
      .forEach((r) => pauseRemedy(r, ap.id, now));
  }
  if (
    [
      "withdraw",
      "reject_appeal",
      "accept_appeal",
      "assign_appeal",
      "decide",
    ].includes(a)
  ) {
    const ap = e as Appeal,
      f = s.findings.find((f) => f.id === ap.findingId)!;
    must(
      latest(f)?.sequence === ap.conclusionSequence,
      "结论已变化，请查看最新结果",
    );
    if (a === "accept_appeal") {
      ap.status = "accepted";
      ap.dueAt = due();
    }
    if (a === "withdraw" || a === "reject_appeal") {
      ap.status = a === "withdraw" ? "withdrawn" : "rejected";
      ap.decidedAt = at;
      if(f.distribution) f.distribution.status="pending";
      cancelAppealReview(s, ap, now);
      s.remedies
        .filter((r) => r.findingId === f.id)
        .forEach((r) => resumeRemedy(r, ap.id, now));
    }
    if (a === "assign_appeal") {
      must(i.dueAt && Date.parse(i.dueAt) <= Date.parse(ap.dueAt), "核查期限不得晚于申诉总期限，请先调整申诉期限");
      const own = inspector();
      if (own === latest(f)?.reviewer) {
        must(
          (i.note ?? "").length >= 8,
          "使用原质检员须说明无其他人员可用的原因（至少 8 字）",
        );
        ap.sameReviewerReason = i.note;
      }
      const r = addReview(f, own, due(), "appeal", ap.id);
      ap.reviewId = r.id;
      ap.status = "reviewing";
    }
    if (a === "decide") {
      const review=s.reviews.find(r=>r.id===ap.reviewId);
      if(f.distribution) {
        must(review && review.status==="supervisor", "申诉须先由质检员核查并提交结果");
        const proposed=review.opinions[f.id]?.value;
        must(i.value === (proposed==="false_positive" ? "false_positive" : proposed==="risk" ? "maintain" : ""), "裁定须确认质检员提交结果；不赞同请退回质检员核对");
        if(i.value==="maintain") {
          distribution(f,i,f.distribution.source,review.owner);
          createRemedy(f,review.owner,"appeal");
        }
      }
      must(
        ["maintain", "false_positive", "insufficient", "adjust"].includes(
          i.value ?? "",
        ),
        "请选择有效裁定",
      );
      evidence(f.callId);
      if (i.value === "adjust")
        must(
          i.goal?.trim() && i.standard?.trim(),
          "调整成立范围须同步填写新目标与标准",
        );
      ap.outcome = i.value as Appeal["outcome"];
      ap.status = "done";
      ap.decidedAt = at;
      cancelAppealReview(s, ap, now, true);
      if (i.value !== "maintain")
        conclude(
          f,
          i.value === "adjust" ? "risk" : (i.value as Verdict),
          i.note!,
          s.reviews.find((r) => r.id === ap.reviewId)?.owner,
        );
      for (const r of s.remedies.filter((r) => r.findingId === f.id)) {
        resumeRemedy(r, ap.id, now);
        if (i.value === "maintain") continue;
        if (terminalRemedy(r)) {
          r.sourceChanged = true;
          r.rev++;
          continue;
        }
        if (i.value === "false_positive" || i.value === "insufficient") {
          terminateRemedy(s, r, i.value === "false_positive" ? "来源结论改判为误报" : "证据不足，原整改依据不充分", now);
        }
        if (i.value === "adjust") {
          r.goal = i.goal!;
          r.standard = i.standard!;
          r.standardSequence++;
          r.standards.push({
            sequence: r.standardSequence,
            goal: r.goal,
            standard: r.standard,
            note: i.note!,
            at,
          });
          r.acceptance = undefined;
          r.status = r.materials.length ? "verification" : "executing";
          r.conclusionSequence = latest(f)!.sequence;
        }
        r.rev++;
      }
      if (i.value === "insufficient" && i.owner) {
        f.status = "supplement";
        addSupplement(f.id, i.owner, "appeal_insufficient");
      }
    }
  }
  if(a==="return_appeal") {
    const ap=e as Appeal, r=s.reviews.find(r=>r.id===ap.reviewId);
    must(r && r.status==="supervisor", "质检员尚未提交申诉核查结果");
    r.status="response";r.supervisorComment=i.note;r.rev++;ap.status="reviewing";
  }
  if(a==="agree_appeal_return" || a==="explain_appeal") {
    const r=e as Review, ap=s.appeals.find(ap=>ap.id===r.appealId)!;
    r.status=a==="agree_appeal_return" ? "working" : "supervisor";
    r.summary=i.note;r.history.push({at,opinions:structuredClone(r.opinions),summary:i.note});
    ap.status=a==="agree_appeal_return" ? "reviewing" : "decision";ap.rev++;
  }
  if (a === "supplement") {
    if ("standardSequence" in e) throw new Error("请通过验收样例不足提出补件");
    const origin = "status" in e ? e.status : "";
    if ("findingIds" in e && e.appealId) {
      const ap = s.appeals.find(x=>x.id === e.appealId)!;
      ap.supplementOrigin = ap.status; ap.status = "supplement"; ap.rev++;
    }
    if ("findingIds" in e) e.evidenceRequest = undefined;
    let executor = "findingIds" in e && e.appealId ? s.appeals.find(ap=>ap.id===e.appealId)!.agentId : i.owner || callFor(s, e.id)!.agentId;
    if (s.appeals.includes(e as Appeal)) {
      const ap = e as Appeal;
      ap.supplementOrigin = ap.status;
      ap.status = "supplement";
      executor = ap.agentId;
      const r = s.reviews.find((r) => r.id === ap.reviewId);
      if (r && !["done", "cancelled"].includes(r.status)) {
        r.status = "supervisor";
        r.rev++;
      }
    }
    if ("conclusions" in e) e.status = "supplement";
    addSupplement("findingIds" in e && e.appealId ? e.appealId : e.id, executor, origin);
  }
  if (a === "reply") {
    const sp = e as Supplement;
    const r = s.remedies.find(r=>r.id===sp.target);
    if(r) {
      must(!terminalRemedy(r), "整改已结束");
      const selected = i.samples ?? [];
      must(selected.length || i.attachment, "请追加整改样例或附件材料");
      must(selected.every(id=>s.calls.some(c=>c.id===id && c.sample && c.agentId===r.agentId && c.business===callFor(s,r.id)!.business && Date.parse(c.endedAt??"")>=Date.parse(r.createdAt))), "请选择整改后的本人授权通话样例");
      r.materials.push({at,text:i.note!,samples:[...new Set(selected)],attachment:i.attachment}); r.rev++;
    }
    sp.reply = i.note;
    sp.status = "submitted";
  }
  if (a === "receive_supplement") {
    const sp = e as Supplement;
    sp.status = "done";
    const target = entity(s, sp.target)!;
    target.rev++;
    if (s.appeals.includes(target as Appeal)) {
      const ap = target as Appeal;
      ap.status = ap.reviewId
        ? "reviewing"
        : sp.origin === "submitted"
          ? "submitted"
          : "accepted";
      const r = s.reviews.find((r) => r.id === ap.reviewId);
      if (r) {
        r.status = "working";
        r.evidenceRequest = undefined;
        r.rev++;
      }
    }
    if ("conclusions" in target) target.status = "candidate";
    if ("findingIds" in target) {target.status = "working"; target.evidenceRequest = undefined;}
  }
  if (a === "sample_calls") {
    const r = e as Remedy,
      source = callFor(s, r.id)!;
    s.calls.push({
      ...structuredClone(source),
      id: uid("SAMPLE"),
      rev: 0,
      startedAt: new Date(now.getTime()-30000).toISOString(),
      endedAt: at,
      duration: 30,
      sample: true,
      audio: undefined,
      authorized: [r.inspector],
      transcript: [
        {
          at: 0,
          speaker: "agent",
          text: "您好，银行客服中心，我先为您确认业务诉求。",
        },
        { at: 7, speaker: "customer", text: "我想查询业务的办理进度。" },
        {
          at: 12,
          speaker: "agent",
          text: "安全核验已完成。请勿提供完整验证码。当前业务条件、办理状态和后续处理方式，我逐项向您说明。",
        },
        { at: 24, speaker: "customer", text: "已经清楚了，谢谢您的说明。" },
      ],
      batches: [
        {
          id: uid("SB"),
          startedAt: at,
          endedAt: at,
          rules: captureRules(s,at),
          checks: [{ name: "场景规则", state: "success" }],
        },
      ],
    });
  }
  if (a === "accept_remedy") (e as Remedy).status = "executing";
  if (a === "adjust_request") {
    const r = e as Remedy;
    r.adjustmentOrigin = r.status === "pending" ? "pending" : "executing";
    r.status = "supervisor";
    r.supervisorReason = "adjust";
  }
  if (a === "reject_adjustment") {
    const r = e as Remedy;
    must(r.status === "supervisor" && r.supervisorReason === "adjust", "当前没有待处理的调整申请");
    r.status = r.adjustmentOrigin ?? "executing"; r.supervisorReason = undefined; r.adjustmentOrigin = undefined;
  }
  if (a === "material") {
    const r = e as Remedy;
    const selected = i.samples ?? [];
    must(
      selected.every((id) =>
        s.calls.some(
          (c) =>
            c.id === id &&
            c.sample &&
            c.agentId === r.agentId &&
            c.business === callFor(s, r.id)!.business &&
            Date.parse(c.endedAt ?? "") >= Date.parse(r.createdAt),
        ),
      ),
      "请选择整改后的本人授权通话样例",
    );
    must(selected.length || i.attachment, "请选择样例或预设附件");
    r.materials.push({
      at,
      text: i.note!,
      samples: selected,
      attachment: i.attachment,
    });
    if (!r.pause) r.status = "verification";
  }
  if (a === "save_acceptance" || a === "verify") {
    const r = e as Remedy;
    must(["pass", "fail", "insufficient"].includes(i.value ?? "pass"), "请选择验收结果");
    if ((r.acceptanceDraft || r.draft) && !acceptanceDraftMatches(r, s.identity))
      must(i.draftBasisConfirmed, "草稿对应的轮次、标准或验收人已变化，请核对后再保存或提交");
    if (r.acceptanceDraft && (a === "verify" || !acceptanceDraftMatches(r, s.identity)))
      (r.acceptanceDraftHistory ??= []).push(structuredClone(r.acceptanceDraft));
    if (!r.acceptanceDraft && r.draft)
      (r.acceptanceDraftHistory ??= []).push({note:r.draft,result:"pass",sequence:0,round:0,author:"",savedAt:""});
    if (a === "save_acceptance") {
      r.acceptanceDraft = {note:i.note!, result:(i.value ?? "pass") as AcceptanceDraft["result"],sequence:r.standardSequence,round:r.round,author:s.identity,savedAt:at,dueAt:i.dueAt};
      r.draft = undefined;
    }
  }
  if (a === "verify") {
    const r = e as Remedy;
    must(!r.pause, "申诉暂停期间只能保存意见草稿");
    must(!r.origin || i.value !== "insufficient", "资料不满足时请选择不通过，并列明补充整改或资料要求");
    must(
      ["pass", "fail", "insufficient"].includes(i.value ?? ""),
      "请选择验收结果",
    );
    const sampleIds = new Set(r.materials.flatMap((m) => m.samples));
    if (i.value === "pass")
      must(
        sampleIds.size >= r.sampleCount &&
          !s.supplements.some((x) => x.target === r.id && openSupplement(x)),
        "样例不足或尚有补件，不能通过",
      );
    r.acceptance = {
      result: i.value as "pass" | "fail" | "insufficient",
      note: i.note!,
      sequence: r.standardSequence,
      round: r.round,
      at,
    };
    r.acceptanceHistory.push({ ...r.acceptance });
    r.acceptanceDraft = undefined;
    r.draft = undefined;
    if (i.value === "insufficient") {
      addSupplement(r.id, r.agentId, "verification");
    } else {
      if(i.value === "pass") {r.status="supervisor";r.supervisorReason="approve";} else returnToAgent(r);
    }
  }
  if (a === "close_remedy") {
    const r = e as Remedy;
    must(
      r.acceptance?.result === "pass" &&
        r.acceptance.sequence === r.standardSequence &&
        r.acceptance.round === r.round &&
        !r.pause,
      "当前标准尚未通过有效验收",
    );
    r.status = "done";
    r.finishedAt = at;
  }
  if (a === "return_remedy") {
    const r=e as Remedy;
    must(validInspector(r.inspector), "请先指定核验质检员");
    r.status="response";r.supervisorComment=i.note;
  }
  if(a==="agree_remedy_return") returnToAgent(e as Remedy);
  if(a==="explain_remedy") {
    const r=e as Remedy;
    must(r.acceptance?.result==="pass", "须保留本轮通过意见及核验依据");
    r.acceptance.note += `\n补充核验说明：${i.note}`;
    r.acceptanceHistory.push({...r.acceptance,at});r.status="supervisor";r.supervisorReason="approve";
  }
  if (a === "change_standard") {
    const r = e as Remedy;
    must(i.standard?.trim() && i.goal?.trim(), "请填写目标及标准");
    r.standard = i.standard!;
    r.goal = i.goal!;
    r.standardSequence++;
    r.standards.push({
      sequence: r.standardSequence,
      standard: r.standard,
      goal: r.goal,
      note: i.note!,
      at,
    });
    r.acceptance = undefined;
    r.status = r.materials.length ? "verification" : "executing";
    r.supervisorReason = undefined;
  }
  if (a === "extend") {
    must("dueAt" in e, "对象没有期限");
    must(!("pause" in e && e.pause), "暂停期间先处理申诉，恢复后再调整期限");
    if (Date.parse(e.dueAt) < now.getTime())
      (e as Review | Appeal | Remedy).firstOverdueAt ??= e.dueAt;
    e.dueAt = due();
    if ("standardSequence" in e && e.supervisorReason === "adjust") { e.status = e.adjustmentOrigin ?? "executing"; e.supervisorReason = undefined; e.adjustmentOrigin = undefined; }
  }
  if (a === "start_detection") {
    const c = e as Call;
    must(
      !c.batches.some((b) => b.checks.some((x) => x.state === "running")),
      "已有检测正在执行",
    );
    must(captureRules(s,at).length>0,"当前没有已开启的指标");
    c.batches.push({
      id: uid("B"),
      startedAt: at,
      rules: captureRules(s,at),
      checks: [
        { name: "转写", state: "running" },
        { name: "场景规则", state: "pending" },
      ],
    });
  }
  if (a === "finish_detection") {
    const c = e as Call,
      b = c.batches.at(-1)!;
    must(
      b.checks.some((x) => x.state === "running"),
      "没有运行中检测",
    );
    b.checks.forEach(
      (x) => (x.state = i.value === "failed" ? "failed" : "success"),
    );
    b.endedAt = at;
  }
  if (a === "reassign") {
    const owner = inspector();
    must(owner !== ("findingIds" in e ? e.owner : "standardSequence" in e ? e.inspector : undefined), "请选择另一位质检员进行转派");
    if ("findingIds" in e) {
      e.owner = owner;
      if (i.dueAt && i.dueAt !== e.dueAt) e.dueAt = due();
      if (e.status === "supervisor") e.status = "working";
      if (e.appealId) {
        if (e.status === "response") e.status = "working";
        const ap = s.appeals.find((x) => x.id === e.appealId)!;
        ap.status = "reviewing";
        ap.rev++;
      }
    }
    if ("standardSequence" in e) {
      e.inspector = owner;
      e.acceptance = undefined;
      if (e.materials.length) e.status = "verification";
      if (i.dueAt && i.dueAt !== e.dueAt) e.dueAt = due();
    }
  }
  if ((a === "accept_result" || a === "appeal") && "conclusions" in e && e.distribution) e.distribution.respondedAt = at;
  e.rev++;
  s.revision++;
  s.requests.push(cmd.requestId);
  const original = entity(state, cmd.id)!;
  const overrun = lateWarningSubmission(state, original, a, now.getTime());
  if (overrun) {
    const owner = currentOwner(state, original);
    const format = (value: string) => new Date(value).toLocaleString('zh-CN', {timeZone:'Asia/Shanghai', hour12:false});
    const seconds = Math.ceil(overrun.exceededByMs / 1000);
    s.logs.push({
      id: uid("EV"), target: e.id, callId: callFor(s,e.id)?.id, at, actor:s.identity, action:"超时提交",
      note:`${actionLabel(state,cmd.id,a)}；原${overrun.label}：${format(overrun.at)}；实际提交：${format(at)}；超限 ${Math.floor(seconds / 3600)} 小时 ${Math.floor(seconds % 3600 / 60)} 分 ${seconds % 60} 秒；当时责任人：${people.find(p=>p.id===owner)?.name ?? '未记录'}。`,
      overrun:{requestId:cmd.requestId, operation:a, deadlineLabel:overrun.label, deadlineAt:overrun.at, submittedAt:at, exceededByMs:overrun.exceededByMs, owner},
    });
  }
  s.logs.push({
    id: uid("EV"),
    target: e.id,
    callId: callFor(s, e.id)?.id,
    at,
    actor: s.identity,
    action: actionLabel(state, cmd.id, a),
    note:
      i.note?.trim() ||
      (a === "end_call"
        ? "原型场景事件：封存证据，有效分派复用，无效分派回主管"
        : "已完成"),
  });
  for (const task of [...s.reviews, ...s.appeals, ...s.remedies]) {
    if (
      Date.parse(task.dueAt) < now.getTime() &&
      !["done", "cancelled", "terminated", "withdrawn", "rejected"].includes(
        task.status,
      ) &&
      !("pause" in task && task.pause)
    )
      task.firstOverdueAt ??= task.dueAt;
  }
  for (const task of [...s.reviews,...s.appeals,...s.remedies,...s.supplements]) {
    const before = entity(state,task.id);
    if(before && "dueAt" in before && before.dueAt !== task.dueAt) {
      const last = task.deadlineChanges?.at(-1);
      if(!last || last.from !== before.dueAt || last.to !== task.dueAt || last.at !== at)
        (task.deadlineChanges ??= []).push({from:before.dueAt,to:task.dueAt,at,reason:i.note || actionNames[a]});
    }
  }
  // All mutations pass through the same authorization, sequence and business guards.
  must(role === roleOf(s), "身份不可在业务动作内变更");
  return reconcileAlerts(a === "finish_detection" && i.value !== "failed" ? replayDetection(s,cmd.id,now) : s, now, actionLabel(state,cmd.id,a));
}
export function activeAppeal(s: State, findingId: string) {
  return s.appeals.find(a=>a.findingId===findingId && !terminalAppeal(a));
}
export function supplementExecutors(s: State, target: string) {
  const call = callFor(s,target);
  return people.filter(p=>call && (p.role !== "agent" || p.id===call.agentId));
}
export function needsRead(s: State, e: Entity) {
  return canSee(s,e.id) && "conclusions" in e && roleOf(s)==="agent" && ((!!e.reminder && !e.reminder.readAt) || (!!latest(e) && e.seenSequence !== latest(e)!.sequence));
}
export function needsWork(s: State, e: Entity): boolean {
  if(!canSee(s,e.id)) return false;
  if ("standardSequence" in e && terminalRemedy(e)) return false;
  if("pause" in e && e.pause) return false;
  if ("standardSequence" in e && !e.inspector && e.origin === "direct" && roleOf(s)==="supervisor") return true;
  if ("findingIds" in e && e.appealId) {
    const parent = s.appeals.find(a => a.id === e.appealId);
    if (!parent || terminalAppeal(parent) || parent.status === "supplement") return false;
  }
  if(s.supplements.some(x=>x.target===e.id && openSupplement(x) && currentOwner(s,x)===s.identity)) return true;
  if ("conclusions" in e && e.distribution?.status === "pending" && e.distribution.extensionRequest && roleOf(s) === "supervisor") return true;
  if("conclusions" in e && e.status === "review") return false;
  if("pause" in e && e.pause) return false;
  if("findingIds" in e && s.supplements.some(x=>x.target===e.id && openSupplement(x))) return false;
  if("findingId" in e && !("standardSequence" in e) && (e.status === "reviewing" || e.status === "supplement")) return false;
  if("standardSequence" in e && s.supplements.some(x=>x.target===e.id && openSupplement(x))) return false;
  return currentOwner(s,e)===s.identity;
}
export function isTodo(s:State,e:Entity) { return needsRead(s,e) || needsWork(s,e); }
export function notices(s: State) {
  const candidates: Entity[] = [...s.findings,...s.reviews,...s.appeals,...s.remedies,...standaloneSupplements(s)];
  return candidates.filter(e=>isTodo(s,e));
}
export function primaryAction(s:State,id:string) {
  const allowed=contextActions(s,id);
  const item=entity(s,id);
  if (item && "standardSequence" in item && item.supervisorReason === "adjust" && allowed.includes("change_standard")) return "change_standard";
  const order=["reply","receive_supplement","accept_result","assign_inspector","dispatch","agree_remedy_return","agree_appeal_return","remind","assign","submit_review","publish","accept_assign","decide","accept_remedy","material","verify","close_remedy","return_remedy","ack","read_reminder","feedback_reminder","supplement","request_evidence","return_review"];
  return order.find(a=>allowed.includes(a));
}
export const csv = (rows: unknown[][]) =>
  "\ufeff" +
  rows
    .map((r) =>
      r
        .map((c) => {
          const text = String(c ?? "");
          return (
            '"' +
            (/^[=+@\-\t\r]/.test(text) ? "'" : "") +
            text.replace(/"/g, '""') +
            '"'
          );
        })
        .join(","),
    )
    .join("\r\n");
