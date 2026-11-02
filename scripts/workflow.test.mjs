import {legacyInitial} from './helpers/legacy-initial.mjs';
import {legacyIssued} from './helpers/legacy-issuance.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { createInitial } from "../lib/fixtures.ts";
import {
  apply,
  actions,
  entity,
  latest,
  canSee,
  canSeeCall,
  notices,
  nav,
  pauseRemedy,
  resumeRemedy,
  detection,
  csv,
} from "../lib/workflow.ts";
import { report, reportCsv } from "../lib/reports.ts";
const now = new Date("2026-09-12T10:00:00+08:00"),
  deadline = "2026-09-14T10:00:00+08:00";
let request = 0;
const start = () => createInitial(now);
const as = (s, id) => ({ ...s, identity: id });
const run = (s, id, action, input = {}, clock = now) =>
  apply(
    s,
    {
      id,
      action,
      rev: entity(s, id).rev,
      requestId: `test-${++request}`,
      input: {
        note: "根据本次证据核对处理",
        evidence: [2],
        owner: "Q01",
        dueAt: deadline,
        ...input,
      },
    },
    clock,
  );
const options = { start: "", end: "", business: "", group: "", agent: "" };
function issued() {
  const s=legacyIssued(now,deadline);
  return [s, s.remedies.at(-1).id];
}
function appealSetup() {
  let [s, id] = issued();
  s = run(as(s, "A1048"), s.remedies.at(-1).findingId, "appeal");
  return [s, id, s.appeals.at(-1).id];
}
function verification() {
  let [s, id] = issued();
  s = run(as(s, "A1048"), id, "accept_remedy");
  s = run(s, id, "sample_calls");
  s = run(s, id, "material", { samples: [s.calls.at(-1).id] });
  return [s, id];
}

test("T01: real-time ending reuses valid assignment; missing assignment returns supervisor; duplicate request id is idempotent", () => {
  let s = start();
  s = run(s, "F-1041", "remind");
  const cmd = {
    id: "CALL-1041",
    action: "end_call",
    rev: 0,
    requestId: "end-once",
    input: { note: "" },
  };
  s = apply(s, cmd, now);
  assert.equal(s.reviews.at(-1).scope, "通话结束后核查提醒风险");
  assert.equal(
    s.reviews.filter((r) => r.findingIds.includes("F-1041")).length,
    1,
  );
  assert.equal(apply(s, cmd, now), s);
  let b = start();
  b = run(b, "F-1041", "remind", { owner: "" });
  b = run(b, "CALL-1041", "end_call");
  assert.equal(b.findings[0].status, "candidate");
  assert.equal(
    b.reviews.filter((r) => r.findingIds.includes("F-1041")).length,
    0,
  );
  assert.ok(actions(b, "F-1041").includes("assign"));
});
test("T02: false positive closes only candidate and never creates remediation", () => {
  let s = start();
  const n = s.remedies.length;
  s = run(s, "F-1037", "dismiss", { value: "false_positive" });
  assert.equal(
    latest(s.findings.find((f) => f.id === "F-1037")).value,
    "false_positive",
  );
  assert.equal(s.remedies.length, n);
});
test("T03: insufficient evidence has owned and dated supplement loop and is excluded from false positives", () => {
  let s = start();
  assert.throws(()=>run(s, "F-1036", "dismiss", { value: "insufficient" }), /仅确认误报/);
  s = run(s, "F-1036", "assign", { owner: "Q01" });
  const reviewId = s.reviews.at(-1).id;
  s = run(as(s, "Q01"), reviewId, "request_evidence");
  s = run(as(s, "S01"), reviewId, "supplement", { owner: "Q02" });
  const sup = s.supplements.at(-1);
  assert.equal(sup.executor, "Q02");
  s = run(as(s, "Q02"), sup.id, "reply");
  s = run(as(s, "S01"), sup.id, "receive_supplement");
  assert.equal(entity(s,reviewId).status,"working");
  assert.equal(entity(s,"F-1036").status,"review");
  assert.ok(
    !report(s, options, now)
      .find((m) => m.key === "fp")
      .rows.some((r) => r.id === "F-1036"),
  );
});
test("T04: distributed risk waits for acceptance is delivered, remains risk, can appeal; ack cannot close or alter verdict", () => {
  let s = start();
  const n = s.remedies.length;
  s = run(s, "F-1037", "dispatch", {goal:"完整说明",standard:"业务条件完整",observation:"后续样例",sampleCount:1});
  assert.equal(s.remedies.length, n);
  s = as(s, "A1048");
  assert.ok(actions(s, "F-1037").includes("appeal"));
  s = run(s, "F-1037", "ack");
  assert.equal(latest(s.findings.find((f) => f.id === "F-1037")).value, "risk");
  assert.ok(actions(s, "F-1037").includes("appeal"));
});
test("T05: issue once, agent accepts/materials, assigned inspector passes, supervisor closes", () => {
  let [s, id] = verification();
  assert.equal(entity(s, id).status, "verification");
  s = run(as(s, "Q01"), id, "verify", { value: "pass" });
  assert.equal(entity(s, id).supervisorReason, "approve");
  assert.ok(!actions(s, id).includes("close_remedy"));
  s = run(as(s, "S01"), id, "close_remedy");
  assert.equal(entity(s, id).status, "done");
  assert.equal(s.remedies.filter((r) => r.id === id).length, 1);
});
test("T06: insufficient samples retain inspector ownership; agent supplements; failed verification returns concrete requirements to agent", () => {
  let [s, id] = verification();
  s = run(as(s, "Q01"), id, "verify", { value: "insufficient" });
  const sp = s.supplements.at(-1);
  assert.equal(entity(s, id).status, "verification");
  assert.ok(!notices(s).some((x) => x.id === id), "质检员等待补样，不重复生成待办");
  assert.ok(notices(as(s,"A1048")).some(x=>x.id===id), "补样任务在坐席原整改内");
  assert.ok(actions(as(s, "A1048"), sp.id).includes("reply"));
  assert.throws(() => run(s, id, "verify", { value: "pass" }), /补件|不允许/);
  s = run(as(s,"A1048"),id,"sample_calls");
  s = run(s, sp.id, "reply", {samples:[s.calls.at(-1).id]});
  s = run(as(s, "Q01"), sp.id, "receive_supplement");
  const passed=run(s,id,"verify",{value:"pass"});
  assert.equal(entity(run(as(passed,"S01"),id,"close_remedy"),id).status,"done");
  s = run(s, id, "verify", { value: "fail" });
  assert.equal(entity(s, id).status, "executing");
  assert.ok(!actions(as(s, "S01"), id).includes("close_remedy"));
  assert.equal(entity(s, id).round, 2);
  assert.equal(entity(s, id).status, "executing");
});
test("T07: preacceptance and in-review appeal supplements both return through supervisor, preserving reviewer", () => {
  let [s, , ap] = appealSetup();
  s = run(as(s, "S01"), ap, "supplement");
  let sp = s.supplements.at(-1).id;
  s = run(as(s, "A1048"), sp, "reply");
  s = run(as(s, "S01"), sp, "receive_supplement");
  assert.equal(entity(s, ap).status, "submitted");
  s = run(s, ap, "accept_appeal");
  s = run(s, ap, "assign_appeal", { owner: "Q02" });
  const r = entity(s, ap).reviewId;
  s = run(s, ap, "supplement");
  assert.deepEqual(actions(as(s, "Q02"), r), []);
  sp = s.supplements.at(-1).id;
  s = run(as(s, "A1048"), sp, "reply");
  assert.equal(entity(s, ap).status, "supplement");
  s = run(as(s, "Q02"), sp, "receive_supplement");
  assert.equal(entity(s, ap).status, "reviewing");
  assert.equal(entity(s, r).owner, "Q02");
});
test("T08: withdraw, reject, maintain restore phase and elapsed pause; old overdue retained", () => {
  for (const result of ["withdraw", "reject_appeal", "maintain"]) {
    let [s, id, ap] = appealSetup();
    const due = entity(s, id).dueAt;
    s = as(s, result === "withdraw" ? "A1048" : "S01");
    if (result === "maintain") {
      s = run(s, ap, "accept_appeal");
      s = run(
        s,
        ap,
        "decide",
        { value: "maintain" },
        new Date(now.getTime() + 3600000),
      );
    } else s = run(s, ap, result, {}, new Date(now.getTime() + 3600000));
    assert.ok(!entity(s, id).pause);
    assert.equal(Date.parse(entity(s, id).dueAt) - Date.parse(due), 3600000);
    assert.equal(entity(s, id).status, "pending");
  }
  let s = legacyInitial(now);
  s = run(as(s, "A1048"), "AP-1033", "withdraw");
  assert.ok(entity(s, "REC-1033").firstOverdueAt);
});
test("T09: false positive / insufficient terminate separately; risk adjustment invalidates old acceptance", () => {
  for (const result of ["false_positive", "insufficient", "adjust"]) {
    let [s, id, ap] = appealSetup();
    s = run(as(s, "S01"), ap, "accept_appeal");
    s = run(s, ap, "decide", {
      value: result,
      goal: "缩小范围的目标",
      standard: "只核对本次有效范围",
      owner: result === "insufficient" ? "Q02" : "",
    });
    const r = entity(s, id);
    assert.equal(
      latest(s.findings.find((f) => f.id === r.findingId)).sequence,
      2,
    );
    if (result === "adjust") {
      assert.equal(r.standardSequence, 2);
      assert.ok(!r.acceptance);
      assert.notEqual(r.status, "done");
    } else {
      assert.equal(r.status, "terminated");
      assert.match(
        r.terminationReason,
        result === "insufficient" ? /依据不充分/ : /误报/,
      );
      assert.ok(
        !report(s, options, now)
          .find((m) => m.key === "ontime")
          .rows.some((x) => x.id === id),
      );
    }
    if (result === "insufficient")
      assert.equal(s.supplements.at(-1).origin, "appeal_insufficient");
  }
});
test("T11: multi-risk counts separate from calls, zero denominators show dash, CSV uses drilldown rows and protects formulas", () => {
  let s = start();
  for(const id of ["WO-1039", "WO-1039-B"]){s=run(s,id,"return_review");const review=entity(s,id);s=run(as(s,review.owner),id,"submit_review",{opinions:Object.fromEntries(review.findingIds.map(fid=>[fid,{value:"risk",note:"质检员完成逐项核实",evidence:[2]}]))});s=as(s,"S01");}
  s = run(s, "WO-1039", "publish", {
    goal:"改善说明",standard:"业务条件完整",observation:"后续样例",sampleCount:1,
    opinions: {
      "F-1039": { value: "risk", note: "两个问题分别成立", evidence: [2] },
    },
  });
  s = run(s, "WO-1039-B", "publish", {goal:"改善说明",standard:"业务条件完整",observation:"后续样例",sampleCount:1,opinions:{"F-1039-B":{value:"risk",note:"处理时限问题单独确认",evidence:[4]}}});
  const m = report(s, options, now),
    risk = m.find((x) => x.key === "risk");
  assert.ok(
    Number(risk.value) > m.find((x) => x.key === "riskcalls").rows.length,
  );
  const empty = report(s, { ...options, business: "不存在" }, now);
  assert.equal(empty.find((x) => x.key === "fp").value, "—");
  const output = reportCsv(risk, s, now.toISOString());
  assert.equal(output.split("\r\n").length, risk.rows.length + 1);
  assert.match(csv([["=1+2"]]), /"'=1\+2"/);
});
test("T12: 3 roles, 7 business routes with one review workspace, identity-scoped objects and actions, stale sequence rejected", () => {
  const s = start();
  assert.equal(nav.supervisor.length, 7);
  for (const routes of Object.values(nav)) {
    assert.equal(routes.filter(view => view === "workorders").length, 1);
    assert.equal(routes.includes("workorders2"), false);
  }
  assert.equal(nav.agent.length, 3);
  const agent = as(s, "A1048");
  assert.equal(canSeeCall(agent, s.calls[3]), false);
  assert.equal(canSee(agent, "REC-1034"), false);
  assert.equal(actions(as(s, "Q02"), "WO-1038").length, 0);
  assert.equal(report(agent, options).length, 0);
  const next = run(s, "F-1041", "remind");
  assert.throws(
    () =>
      apply(next, {
        id: "F-1041",
        action: "assign",
        rev: 0,
        requestId: "stale",
        input: {},
      }),
    /记录已更新/,
  );
});
test("T13: normal spotcheck creates no false positive; a second finding requires a separate work order", () => {
  let s = start();
  const original = s.findings.length;
  s = run(s, "CALL-1025", "spotcheck", { scope: "身份核验完整性" });
  const id = s.reviews.at(-1).id;
  s = run(as(s, "Q01"), id, "submit_review", { value: "clear", opinions: {} });
  s = run(as(s, "S01"), id, "publish");
  assert.equal(s.findings.length, original);
  assert.equal(entity(s, id).status, "done");
  s = run(s, "CALL-1024", "spotcheck", { scope: "全部业务核验" });
  const multi = s.reviews.at(-1).id;
  s = run(as(s, "Q01"), multi, "add_finding", {
    title: "人工发现第一项问题",
    ruleId: "R-SOP-006",
  });
  assert.throws(() => run(s, multi, "add_finding", {
    title: "人工发现第二项问题", ruleId: "R-SVC-009",
  }), /不允许|一个问题|另建工单/);
  assert.equal(entity(s, multi).findingIds.length, 1);
  s = run(as(s, "S01"), "CALL-1024", "spotcheck", { scope: "服务表达核验" });
  const separate = s.reviews.at(-1).id;
  s = run(as(s, "Q01"), separate, "add_finding", { title: "人工发现第二项问题", ruleId: "R-SVC-009" });
  assert.equal(entity(s, separate).findingIds.length, 1);
  assert.notEqual(entity(s, multi).findingIds[0], entity(s, separate).findingIds[0]);
});
test("T14: human-added finding never enters automatic-candidate precision denominator", () => {
  let s = start();
  const before = report(s, options, now).find((x) => x.key === "fp").rows
    .length;
  s = run(s, "CALL-1024", "spotcheck", { scope: "业务解释检查" });
  const id = s.reviews.at(-1).id;
  s = run(as(s, "Q01"), id, "add_finding", {
    title: "人工发现待核对问题",
    ruleId: "R-SOP-006",
  });
  const fid = s.findings.at(-1).id;
  s = run(s, id, "submit_review", {
    opinions: {
      [fid]: {
        value: "false_positive",
        note: "人工核对后不成立",
        evidence: [2],
      },
    },
  });
  s = run(as(s, "S01"), id, "publish");
  assert.equal(
    report(s, options, now).find((x) => x.key === "fp").rows.length,
    before,
  );
});
test("T15: withdrawal cancels open appeal review and invalidates captured form, retains draft opinions", () => {
  let [s, , ap] = appealSetup();
  s = run(as(s, "S01"), ap, "accept_appeal");
  s = run(s, ap, "assign_appeal", { owner: "Q02" });
  const id = entity(s, ap).reviewId;
  s = run(as(s, "Q02"), id, "save_review", {
    opinions: {
      "F-1039": { value: "risk", note: "尚在核查的草稿", evidence: [2] },
    },
  });
  const revision = entity(s, id).rev;
  s = run(as(s, "A1048"), ap, "withdraw");
  assert.equal(entity(s, id).status, "cancelled");
  assert.ok(entity(s, id).opinions["F-1039"]);
  assert.throws(
    () =>
      apply(as(s, "Q02"), {
        id,
        action: "submit_review",
        rev: revision,
        requestId: "old-appeal-form",
        input: {},
      }),
    /记录已更新/,
  );
  assert.ok(!notices(as(s, "Q02")).some((x) => x.id === id));
});
test("T16: changing a completion standard invalidates prior approval; supplement executor cannot close", () => {
  let [s, id] = verification();
  s = run(as(s, "Q01"), id, "verify", { value: "pass" });
  assert.throws(() => run(as(s, "S01"), id, "change_standard"), /不允许/);
  s = run(as(s, "S01"), id, "return_remedy");
  s = run(as(s, "Q01"), id, "agree_remedy_return");
  s = run(as(s, "S01"), id, "change_standard", {
    goal: "补充新范围",
    standard: "新版验收完成标准",
  });
  assert.equal(entity(s, id).status, "executing");
  assert.equal(entity(s, id).standardSequence, 2);
  assert.ok(entity(s, id).acceptanceHistory.length);
  assert.ok(!actions(s, id).includes("close_remedy"));
  assert.throws(() => run(as(s, "A1048"), id, "close_remedy"), /不允许/);
});
test("T18: overlapping pauses count their union, first overdue and original deadline never disappear", () => {
  const s = start(),
    r = s.remedies[0];
  r.dueAt = new Date(now.getTime() - 1000).toISOString();
  const original = r.originalDueAt;
  pauseRemedy(r, "one", now);
  pauseRemedy(r, "two", new Date(now.getTime() + 1000));
  resumeRemedy(r, "one", new Date(now.getTime() + 2000));
  assert.ok(r.pause);
  resumeRemedy(r, "two", new Date(now.getTime() + 5000));
  assert.equal(r.pauseHistory[0].duration, 5000);
  assert.ok(r.firstOverdueAt);
  assert.equal(r.originalDueAt, original);
});
test("D01: withdrawn or unaccepted can resubmit, substantive decision cannot repeat same sequence, changed adverse sequence can appeal", () => {
  let [s, , ap] = appealSetup();
  const oldVersion = latest(s.findings.find((f) => f.id === "F-1035")).sequence;
  s = run(as(s, "A1048"), "F-1035", "feedback_result", {
    note: "补充非正式意见，请主管核对本次判断依据",
  });
  assert.equal(
    latest(s.findings.find((f) => f.id === "F-1035")).sequence,
    oldVersion,
  );
  assert.equal(s.logs.at(-1).action, "补充结果意见");

  s = run(as(s, "A1048"), ap, "withdraw");
  assert.ok(actions(s, "F-1039").includes("appeal"));
  s = run(s, "F-1039", "appeal");
  ap = s.appeals.at(-1).id;
  s = run(as(s, "S01"), ap, "reject_appeal");
  s = run(as(s, "A1048"), "F-1039", "appeal");
  ap = s.appeals.at(-1).id;
  s = run(as(s, "S01"), ap, "accept_appeal");
  s = run(s, ap, "decide", { value: "maintain" });
  assert.ok(!actions(as(s, "A1048"), "F-1039").includes("appeal"));
  assert.ok(!actions(as(s, "A1048"), "F-1035").includes("appeal"));
});
test("D03: preferred alternate reviewer exists; same reviewer needs a recorded reason", () => {
  let [s, , ap] = appealSetup();
  s = run(as(s, "S01"), ap, "accept_appeal");
  assert.throws(
    () => run(s, ap, "assign_appeal", { owner: "Q01", note: "原人复核" }),
    /8 字/,
  );
  s = run(s, ap, "assign_appeal", {
    owner: "Q01",
    note: "其他质检员暂不可用，登记同人复核原因",
  });
  assert.ok(entity(s, ap).sameReviewerReason);
});
test("Detection failures are execution states and do not become successful after human review", () => {
  const s = start();
  assert.equal(detection(s.calls[12]), "部分失败");
  assert.equal(detection(s.calls[13]), "失败");
  assert.equal(detection(s.calls[0]), "处理中");
});

test("Reassignment: old inspector loses submit permission and original draft remains", () => {
  let s = start();
  s = run(as(s, "Q01"), "WO-1038", "save_review", {
    opinions: {
      "F-1040": {
        value: "insufficient",
        note: "原人员尚在核查的草稿",
        evidence: [1],
      },
    },
  });
  const rev = entity(s, "WO-1038").rev;
  s = run(as(s, "S01"), "WO-1038", "reassign", { owner: "Q02" });
  assert.equal(entity(s, "WO-1038").owner, "Q02");
  assert.equal(actions(as(s, "Q01"), "WO-1038").length, 0);
  assert.ok(entity(s, "WO-1038").opinions["F-1040"]);
  assert.throws(
    () =>
      apply(as(s, "Q01"), {
        id: "WO-1038",
        action: "submit_review",
        rev,
        requestId: "old-owner",
        input: {},
      }),
    /记录已更新/,
  );
});

test("Appeal submitted review becomes completed after substantive adjudication; new adverse sequence can appeal", () => {
  let [s, , ap] = appealSetup();
  s = run(as(s, "S01"), ap, "accept_appeal");
  s = run(s, ap, "assign_appeal", { owner: "Q02" });
  const reviewId = entity(s, ap).reviewId;
  s = run(as(s, "Q02"), reviewId, "submit_review", {
    opinions: {
      "F-1039": {
        value: "risk",
        note: "核查后确认部分范围成立",
        evidence: [2],
      },
    },
  });
  s = run(as(s, "S01"), ap, "decide", {
    value: "adjust",
    goal: "仅保留已证实范围",
    standard: "调整后的核对标准",
  });
  assert.equal(entity(s, reviewId).status, "done");
  assert.ok(actions(as(s, "A1048"), "F-1039").includes("appeal"));
});
