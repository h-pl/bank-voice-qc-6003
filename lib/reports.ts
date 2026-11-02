import {alertStatusLabel,alertResultLabel} from './call-alerts.ts';
import { remedyReportStages, remedyReportStage, appealOutcomeLabels } from "./report-status.ts";
import {
  latest,
  statusNames,
  verdictNames,
  entity,
  terminalRemedy,
  terminalAppeal,
  detection,
  csv,
  callFor,
  roleOf,
  type State,
  type Call,
} from "./workflow.ts";
export type ReportFilter = {
  business: string;
  group: string;
  agent: string;
  start: string;
  end: string;
};
export type Row = {
  id: string;
  callId: string;
  title: string;
  status: string;
  date: string;
};
export type Metric = {
  key: string;
  label: string;
  value: string;
  note: string;
  rows: Row[];
};
export const localDate = (s: string) =>
  new Date(s).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
export function report(s: State, f: ReportFilter, asOf = new Date()): Metric[] {
  if (roleOf(s) !== "supervisor") return [];
  const inRange = (date: string | undefined) =>
    !!date &&
    (!f.start || localDate(date) >= f.start) &&
    (!f.end || localDate(date) <= f.end);
  const scope = (c: Call | undefined) =>
    !!c &&
    (!f.business || c.business === f.business) &&
    (!f.group || c.group === f.group) &&
    (!f.agent || c.agentId === f.agent);
  const calls = s.calls.filter((c) => scope(c) && inRange(c.endedAt)),
    ids = new Set(calls.map((c) => c.id));
  const auto = s.findings.filter(
    (x) => x.source === "auto" && ids.has(x.callId),
  );
  const known = auto.filter((x) =>
      ["risk", "false_positive"].includes(latest(x)?.value ?? ""),
    ),
    fp = known.filter((x) => latest(x)?.value === "false_positive");
  const risk = s.findings.filter(
    (x) => ids.has(x.callId) && latest(x)?.value === "risk",
  );
  const completed = calls.filter((c) => detection(c) === "已完成");
  const completedRisk = completed.filter((c) =>
    risk.some((x) => x.callId === c.id),
  );
  const row = (
    id: string,
    title: string,
    status: string,
    date: string,
  ): Row => ({ id, callId: callFor(s, id)?.id ?? "", title, status: s.appeals.some(a=>a.id===id) && appealOutcomeLabels[status] ? appealOutcomeLabels[status] : s.findings.some(f=>f.id===id && f.source==="manual") && status==="false_positive" ? "人工问题已撤销" : s.findings.some(f=>f.id===id && f.source==="auto") && status==="false_positive" ? "自动预警误报" : s.remedies.some(r=>r.id===id) ? remedyReportStages.find(([key])=>key===remedyReportStage(s.remedies.find(r=>r.id===id)!))![1] : status === "pending" && s.remedies.some(r=>r.id===id) ? "待坐席接收" : status === "supervisor" && s.reviews.some(r=>r.id===id && r.evidenceRequest) ? "待主管协调补证" : ({...statusNames,...verdictNames,maintain:"维持原结论",adjust:"调整成立范围"} as Record<string,string>)[status] ?? status, date });
  const callRows = (arr: Call[]) =>
    arr.map((c) =>
      row(c.id, c.business, detection(c), c.endedAt ?? c.startedAt),
    );
  const findingRows = (arr: typeof auto) =>
    arr.map((x) =>
      row(
        x.id,
        x.title,
        latest(x)?.value ?? x.status,
        callFor(s, x.id)!.endedAt ?? "",
      ),
    );
  const ratio = (n: number, d: number) =>
    d ? `${((n / d) * 100).toFixed(1)}%` : "—";
  const alerts=s.alerts.filter(a=>ids.has(a.callId));
  const alertMetric=(key:string,label:string,items:typeof alerts):Metric=>({key,label,value:String(items.length),note:"按通话去重；使用当前动态等级与问题办结进度",rows:items.map(a=>row(a.id,`通话告警 · ${a.completed}/${a.problemIds.length} 已办结 · ${alertResultLabel(a)}`,alertStatusLabel(a),a.closedAt??a.createdAt))});
  const result: Metric[] = [
    alertMetric("alerts","告警通话",alerts),
    alertMetric("alerts-pending","待处理告警",alerts.filter(a=>a.status==="pending")),
    alertMetric("alerts-open","处理中告警",alerts.filter(a=>a.status==="open")),
    alertMetric("alerts-closed","已关闭告警",alerts.filter(a=>a.status==="closed")),
    ...(["high","medium","low","none"] as const).map(level=>alertMetric(`alert-${level}`,({high:"高风险告警",medium:"中风险告警",low:"低风险告警",none:"无待办自动风险"})[level],alerts.filter(a=>a.status!=="closed"&&a.level===level))),
    {
      key: "calls",
      label: "范围内通话",
      value: String(calls.length),
      note: "按通话结束日期归属；不含通话中记录",
      rows: callRows(calls),
    },
    {
      key: "completed",
      label: "自动检测完成",
      value: String(completed.length),
      note: "全部场景必需检查执行成功；不等于没有风险",
      rows: callRows(completed),
    },
    {
      key: "coverage",
      label: "自动处理成功占比",
      value: ratio(completed.length, calls.length),
      note: `已完成 ${completed.length} / 范围内已结束通话 ${calls.length}`,
      rows: callRows(calls),
    },
    {
      key: "riskcalls",
      label: "确认风险通话占比",
      value: ratio(completedRisk.length, completed.length),
      note: `已完成群内确认风险通话 ${completedRisk.length} / 已完成 ${completed.length}；按通话去重`,
      rows: callRows(completedRisk),
    },
    {
      key: "candidates",
      label: "自动候选问题",
      value: String(auto.length),
      note: "按问题 ID 去重；关联指标不重复计数",
      rows: findingRows(auto),
    },
    {
      key: "risk",
      label: "当前确认问题",
      value: String(risk.length),
      note: "自动候选与人工发现的最新成立结论",
      rows: findingRows(risk),
    },
    {
      key: "manual",
      label: "人工发现问题",
      value: String(
        s.findings.filter((x) => x.source === "manual" && ids.has(x.callId))
          .length,
      ),
      note: "独立列示，不进入自动候选误报分母",
      rows: findingRows(
        s.findings.filter((x) => x.source === "manual" && ids.has(x.callId)),
      ),
    },
    {
      key: "fp",
      label: "人工确认误报占比",
      value: ratio(fp.length, known.length),
      note: `自动候选中误报 ${fp.length} /（误报 + 成立）${known.length}；不是模型 FPR`,
      rows: findingRows(known),
    },
  ];
  for (const [key, name] of [
    ["partial", "部分失败"],
    ["failed", "失败"],
    ["running", "处理中"],
    ["pending", "待处理"],
  ] as const) {
    const subset = calls.filter((c) => detection(c) === name);
    result.push({
      key,
      label: `检测${name}`,
      value: String(subset.length),
      note: "按已结束通话群的必需检查状态互斥统计",
      rows: callRows(subset),
    });
  }
  const activeAppealRisks = risk.filter((f) =>
    s.appeals.some((a) => a.findingId === f.id && !terminalAppeal(a)),
  );
  result.push({
    key: "riskappealing",
    label: "其中申诉中问题",
    value: String(activeAppealRisks.length),
    note: "当前成立问题的附加标记，不重复累计问题总量",
    rows: findingRows(activeAppealRisks),
  });
  const appeals = s.appeals.filter(
    (a) =>
      scope(callFor(s, a.id)) && inRange(a.decidedAt) && a.status === "done",
  );
  const changed = appeals.filter((a) => a.outcome !== "maintain");
  result.push({
    key: "appealchange",
    label: "申诉改判占比",
    value: ratio(changed.length, appeals.length),
    note: `按裁定日：改判 ${changed.length} / 实质办结 ${appeals.length}；排除撤回、不受理`,
    rows: appeals.map((a) =>
      row(
        a.id,
        s.findings.find((x) => x.id === a.findingId)!.title,
        a.outcome ?? "",
        a.decidedAt!,
      ),
    ),
  });
  for (const [prefix, label, tasks] of [
    ["review", "复核", s.reviews],
    ["appeal", "申诉", s.appeals],
    ["remedy", "整改", s.remedies],
  ] as const) {
    const scoped = tasks.filter((x) => scope(callFor(s, x.id))),
      active = scoped.filter((x) =>
        "standardSequence" in x
          ? !terminalRemedy(x)
          : "conclusionSequence" in x
            ? !terminalAppeal(x)
            : !["done", "cancelled"].includes(x.status),
      );
    const taskRows = (arr: typeof scoped) =>
      arr.map((x) => row(x.id, `${label}任务`, x.status, x.dueAt));
    const overdue = active.filter(
      (x) => Date.parse(x.dueAt) < asOf.getTime() && !("pause" in x && x.pause),
    );
    const due = scoped.filter((x) => inRange(x.dueAt));
    if (prefix !== "remedy") {
      const onTime = due.filter((x) => {
        const end =
          "decidedAt" in x
            ? x.decidedAt
            : "finishedAt" in x
              ? x.finishedAt
              : undefined;
        return (
          x.status === "done" &&
          end &&
          !x.firstOverdueAt &&
          Date.parse(end) <= Date.parse(x.dueAt)
        );
      });
      result.push({
        key: `${prefix}-ontime`,
        label: `按时办结${label}数量`,
        value: String(onTime.length),
        note: "按有效到期日归属；曾逾期不计入，不计算比例",
        rows: taskRows(onTime),
      });
    }

    result.push(
      {
        key: `${prefix}-backlog`,
        label: `当前${label}积压`,
        value: String(active.length),
        note: `截至当前时刻全部未完成，独立于日期范围；最早有效期限 ${active.length ? new Date(Math.min(...active.map(x=>Date.parse(x.dueAt)))).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:false}) + "（北京时间）" : "—"}`,
        rows: taskRows(active),
      },
      {
        key: `${prefix}-due`,
        label: `范围内到期${label}`,
        value: String(due.length),
        note: "按当前有效期限归属；保留原期限和暂停历史",
        rows: taskRows(due),
      },
      {
        key: `${prefix}-overdue`,
        label: `当前逾期${label}`,
        value: String(overdue.length),
        note: "当前有效期限已过且未暂停；历史逾期单独保留",
        rows: taskRows(overdue),
      },
    );
  }
  for (const [key, name] of remedyReportStages) {
    const subset = s.remedies.filter(
      (r) => scope(callFor(s, r.id)) && remedyReportStage(r) === key,
    );
    result.push({
      key: `remedy-state-${key}`,
      label: `整改${name}`,
      value: String(subset.length),
      note: "当前管理范围的互斥基础状态；暂停与补件另列",
      rows: subset.map((r) => row(r.id, r.goal, r.status, r.dueAt)),
    });
  }
  const materialPending = s.remedies.filter(
    (r) =>
      scope(callFor(s, r.id)) &&
      s.supplements.some((x) => x.target === r.id && (x.status === "pending" || x.status === "submitted")),
  );
  result.push({
    key: "materialpending",
    label: "整改待补材料",
    value: String(materialPending.length),
    note: "附加标记，主责任人仍为验收质检员",
    rows: materialPending.map((r) => row(r.id, r.goal, r.status, r.dueAt)),
  });
  const remedies = s.remedies.filter((r) => scope(callFor(s, r.id))),
    paused = remedies.filter((r) => !!r.pause),
    terminated = remedies.filter(
      (r) => r.status === "terminated" && inRange(r.finishedAt),
    ),
    onTime = remedies.filter(
      (r) =>
        r.status === "done" &&
        inRange(r.dueAt) &&
        !r.firstOverdueAt &&
        Date.parse(r.finishedAt!) <= Date.parse(r.dueAt),
    ),
    extended = remedies.filter((r) => r.dueAt !== r.originalDueAt),
    ever = remedies.filter((r) => !!r.firstOverdueAt),
    changedSource = remedies.filter((r) => r.sourceChanged && r.status === "done");
  for (const [key, label, rows, note] of [
    ["paused", "暂停整改", paused, "暂停为附加标记，不再累加到基础状态总数"],
    ["terminated", "终止整改", terminated, "按终止日期归属；不计入整改完成"],
    [
      "ontime",
      "按时结案数量",
      onTime,
      "按有效到期日归属；首次逾期过的整改不计入，无按时率",
    ],
    [
      "extended",
      "期限已调整整改",
      extended,
      "当前管理范围快照；包括暂停顺延与人工调整",
    ],
    [
      "everoverdue",
      "曾逾期整改",
      ever,
      "当前管理范围快照；申诉暂停不抹除历史逾期",
    ],
    [
      "sourcechanged",
      "已结案来源改判",
      changedSource,
      "保留历史结案，单列来源结论变更",
    ],
  ] as const)
    result.push({
      key,
      label,
      value: String(rows.length),
      note,
      rows: rows.map((r) => row(r.id, r.goal, r.status, r.dueAt)),
    });
  return result;
}
export function reportCsv(
  metric: Metric,
  s: State,
  asOf: string,
  filter?: ReportFilter,
) {
  return csv([
    [
      "统计截止",
      "指标",
      "对象编号",
      "通话编号",
      "状态",
      "归属时间",
      "原期限",
      "当前期限",
      "首次逾期",
      "暂停起点",
      "暂停历史",
      "期限变更记录",
      `指标说明；筛选=${JSON.stringify(filter ?? {})}`,
    ],
    ...metric.rows.map((r) => {
      const t = [...s.reviews, ...s.appeals, ...s.remedies].find(
        (x) => x.id === r.id,
      );
      return [
        asOf,
        metric.label,
        r.id,
        r.callId,
        r.status,
        r.date,
        t?.originalDueAt,
        t?.dueAt,
        t?.firstOverdueAt,
        t && "pause" in t ? t.pause?.startedAt : "",
        t && "pauseHistory" in t ? JSON.stringify(t.pauseHistory) : "",
        entity(s,r.id)?.deadlineChanges?.map(h=>`${h.at} ${h.from} → ${h.to} ${h.reason}`).join("；") ?? "",
        metric.note,
      ];
    }),
  ]);
}
