"use client";
import { businessRecordText } from "../lib/timeline-presentation";
import { CallReference, CopyRecordId } from "./record-id";
import { reviewResultLabel } from "../lib/lifecycle-labels";
import type { PrdState } from "../lib/prd-seed-catalog";
import type { ReactNode } from 'react';
import { Badge } from './ui';
import { Button } from './ui/button';
import { ResourceContent } from './policy-content';
import { indicatorName, indicatorRuleName } from '../lib/strategy-schema';
import { findingContext } from '../lib/finding-context';
import { person, type Finding, type Review, type State } from '../lib/workflow';
const date = (value?: string) => value ? new Intl.DateTimeFormat('zh-CN', { timeZone:'Asia/Shanghai', month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false }).format(new Date(value)) : '未记录';

export function Review2FindingDetail({ state, finding, review, onRule, onCall, children, showIdentity = true, inline = false }: { state: State; finding: Finding; review?: Review; children:ReactNode | ((basis: ReactNode) => ReactNode); showIdentity?:boolean } & ({ inline:true; onRule?:never; onCall?:never } | { inline?:false; onRule:()=>void; onCall:()=>void })) {
  const { rule, basis, summary } = findingContext(state, finding);
  const opinion = review?.opinions[finding.id];
  const warning = (state as PrdState).warningDecisions?.find(item=>item.findingId===finding.id);
  const detection = (state as PrdState).detectionResults?.find(item=>item.id===warning?.detectionId);
  const policy = state.policies.find(item=>item.id===warning?.policyId);
  const submission = state.logs.filter(log=>review && (log.target===review.id || log.relatedTargets?.includes(review.id)) && log.action==='提交复核意见').at(-1);
  const draft = !!review && (!['supervisor','done'].includes(review.status) || inline && (!!review.evidenceRequest || state.supplements.some(sp => (sp.target === review.id || sp.target === review.appealId) && ['pending','submitted'].includes(sp.status))));
  const warningDetails = warning && <dl className="review2-summary-fields"><div><dt>触发策略</dt><dd>{policy?.name ?? <CopyRecordId id={warning.policyId}/>}</dd></div><div><dt>预警判断</dt><dd>满足指标规则中的检测条件</dd></div><div><dt>检查范围</dt><dd>{detection ? `${detection.role === 'customer' ? '客户' : detection.role === 'agent' ? '坐席' : '角色未记录'} · ${warning.conditions.stage} · ${detection.range[0]}–${detection.range[1]} 秒` : `${warning.conditions.stage} · 检查范围未记录`}</dd></div><div><dt>触发条件</dt><dd>{warning.reason}</dd></div></dl>;
  const originLabel = finding.source === "auto" ? "预警依据" : "发现依据";
  const checkDetails = basis && <div className="finding-checks">{basis.checks.map(check=><div key={check.requirement}><div><b>{check.requirement}</b><>{inline ? <span className="review2-check-note">{["待核对", "待补证"].includes(check.result) ? "核查提示" : "记录结果"}：{check.result}</span> : <Badge tone="warning">{check.result}</Badge>}</></div>{businessRecordText(check.observation)!==businessRecordText(summary) && <p>{businessRecordText(check.observation)}</p>}</div>)}</div>;
  const reviewSection = (review || !!finding.conclusions.length) && <section className="finding-detail-section" aria-label="人工复核">{review && <h3>{draft?'复核草稿':'人工复核'}</h3>}{opinion ? <><div className="finding-review-result"><Badge tone={opinion.value==='risk'?'danger':opinion.value==='false_positive'?'success':'warning'}>{reviewResultLabel(opinion.value,review?.type ?? 'candidate')}</Badge><span>{draft?'尚未提交':finding.conclusions.length?'历史复核建议':'复核建议，待主管确认'}</span></div><p>{businessRecordText(opinion.note || '尚未填写详细理由')}</p><div className="finding-detail-meta"><span>{submission?'提交人':'当前复核人'}：{person(submission?.actor ?? review?.owner ?? '')?.name ?? '未记录'}</span><span>{submission?'提交时间':'复核记录时间'}：{date(submission?.at ?? review?.history.at(-1)?.at)}</span></div></> : review ? <p className="subtle">尚未填写复核意见。</p> : null}
      {!!finding.conclusions.length && <div className="finding-conclusions"><h3>正式结论</h3>{[...finding.conclusions].reverse().map(c=><div key={c.sequence}><b>{reviewResultLabel(c.value,finding.source==='manual'?'spotcheck':'candidate')}</b><p>{businessRecordText(c.note)}</p><small>{person(c.by)?.name ?? '未记录'} · {date(c.at)}</small></div>)}</div>}
    </section>;
  return <div className="finding-detail">
    {showIdentity && <div className="finding-detail-meta"><CopyRecordId id={finding.id}/><span>问题来源：{finding.source==='auto'?'系统检出':'人工发现'}</span>{!inline && <span>来源通话 <CallReference id={finding.callId} onOpen={onCall!}/></span>}</div>}
    {inline ? <section className="review2-problem-area" aria-label="问题说明">
      <p className="review2-problem-description">{businessRecordText(summary)}</p>
    </section> : <section className="finding-detail-section" aria-label="问题与触发依据">
      <dl className="review2-summary-fields"><div><dt>关联指标</dt><dd><Button variant="link" className="review2-inline-link" onClick={onRule}>{indicatorName(finding.indicator)}</Button></dd></div><div><dt>命中规则</dt><dd>{rule ? <Button variant="link" className="review2-inline-link" onClick={onRule}>{rule.name}</Button> : <>{indicatorRuleName(finding.indicator)} <Button variant="link" onClick={onRule}>查看规则</Button></>}</dd></div></dl>
      {warningDetails}<h3>为什么标记为问题</h3><p>{businessRecordText(summary)}</p>{checkDetails}
    </section>}
    <section className={`finding-detail-section finding-audio${inline ? " inline-evidence-surface" : ""}`} aria-label="完整录音与证据">{typeof children === "function" ? children(<section className="review2-evidence-basis" aria-label={originLabel}><h3>{originLabel}</h3><p className="review2-origin-note">{finding.source === "auto" ? "预警侧记录；核查提示不代表当前工单办理状态。" : "人工登记的发现依据。"}</p>{warningDetails}{checkDetails}{!warning && !basis?.checks.length && <p className="subtle">暂无详细依据记录。</p>}</section>) : children}</section>
    {!inline && reviewSection}
  </div>;
}

export function Review2RuleDetail({ state, finding }: { state:State; finding:Finding }) {
 const { captured } = findingContext(state,finding);
 return <div className="finding-detail">{captured ? <><h3>{state.rules.find(r=>r.id===captured.ruleId)?.name??captured.ruleName}</h3><p>检测依据记录于 {date(captured.capturedAt)}</p><ResourceContent resource={captured.resource}/><h4>检测条件</h4>{captured.conditions.map((c,i)=><p key={i}>{c.feature} · {c.role} · {c.stage} · {c.mode} {c.mode==="持续时长"?`${c.duration} 秒`:c.mode==="累计次数"?`${c.count} 次 / ${c.windowSeconds || "整通"} 秒`:""}</p>)}</> : <p>本次发现未附带资源快照，请结合原始证据核对。</p>}</div>;
}
