"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { canSee, type Finding, type Review, type State } from "../lib/workflow";
import { Review2FindingDetail } from "./review2-detail";

export function Review2Findings({ state, review, renderEvidence }: {
  state: State;
  review: Review;
  renderEvidence: (finding: Finding, basis: ReactNode) => ReactNode;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const section = sectionRef.current;
    const content = section?.closest<HTMLElement>(".case-content");
    const transcript = section?.querySelector<HTMLElement>(".transcript-linked");
    if (!section || !content || !transcript) return;
    // Use actual available space: long explanations must not collapse the transcript.
    const update = () => {
      const top = transcript.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop;
      const remaining = content.clientHeight - top - 28;
      section.dataset.readerFit = String(remaining >= 160);
    };
    const observer = new ResizeObserver(update);
    [content, section.querySelector(".review2-problem-area"), section.querySelector(".recording-player-linked"), section.querySelector(".recording-unavailable")].forEach(element => { if (element) observer.observe(element); });
    update();
    return () => observer.disconnect();
  }, [review.id]);
  if (review.findingIds.length !== 1) return <p role="status">工单问题关联异常，请刷新页面后重试。</p>;
  const finding = state.findings.find(item => item.id === review.findingIds[0]);
  if (!finding || !canSee(state, finding.id)) return <p>关联问题暂不可查看。</p>;
  return <section ref={sectionRef} className="review2-findings review2-findings-inline" aria-label="问题与证据">
    <article className="review2-inline-issue" aria-label={finding.title}>
      <Review2FindingDetail state={state} finding={finding} review={review} inline showIdentity={false}>
        {basis => renderEvidence(finding, basis)}
      </Review2FindingDetail>
    </article>
  </section>;
}
