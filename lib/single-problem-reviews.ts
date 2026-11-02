import type { State, Review, Opinion } from './workflow.ts';

/** Split persisted joint reviews without reseeding or reinterpreting their judgments. */
export function splitLegacyReviews<T extends State>(input: T, now = new Date()): T {
  if (!input.reviews.some(review => review.findingIds.length > 1)) return input;
  const state = structuredClone(input);
  const used = new Set([...state.calls, ...state.findings, ...state.reviews, ...state.appeals,
    ...state.remedies, ...state.supplements, ...state.rules, ...state.resources, ...state.logs].map(item => item.id));
  const allocate = (base: string) => {
    let id = base, suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    return id;
  };
  const pickOpinion = (opinions: Record<string, Opinion>, id: string) =>
    opinions[id] ? { [id]: structuredClone(opinions[id]) } : {};
  const reviews: Review[] = [];
  for (const original of input.reviews) {
    if (original.findingIds.length <= 1) {
      reviews.push(state.reviews.find(review => review.id === original.id)!);
      continue;
    }
    const ids = [...new Set(original.findingIds)];
    const parts = ids.map((findingId, index) => {
      const finding = state.findings.find(item => item.id === findingId);
      const review: Review = {
        ...structuredClone(original),
        id: index === 0 ? original.id : allocate(`${original.id}-S${index + 1}`),
        rev: original.rev + 1,
        callId: finding?.callId ?? original.callId,
        findingIds: [findingId],
        opinions: pickOpinion(original.opinions, findingId),
        history: original.history.map(entry => ({ ...structuredClone(entry), opinions: pickOpinion(entry.opinions, findingId) })),
      };
      if (original.appealId) {
        const appeal = state.appeals.find(item => item.id === original.appealId);
        if (appeal?.findingId !== findingId) {
          delete review.appealId;
          review.type = finding?.source === 'manual' ? 'spotcheck' : 'candidate';
        }
      }
      return review;
    });
    reviews.push(...parts);
    // Preserve exact originals, including any historical opinions no longer in findingIds.
    (state.reviewSplits ??= []).push({ source: structuredClone(original), at: now.toISOString(),
      parts: parts.map(review => ({ reviewId: review.id, findingId: review.findingIds[0] })) });
    for (const appeal of state.appeals.filter(item => item.reviewId === original.id)) {
      const replacement = parts.find(review => review.findingIds[0] === appeal.findingId);
      if (replacement && replacement.id !== appeal.reviewId) { appeal.reviewId = replacement.id; appeal.rev++; }
    }
    for (const part of parts.slice(1)) {
      const targets = new Map([[original.id, part.id]]);
      // Each split review owns independent supplement progress; copied material retains provenance.
      let pending = input.supplements.filter(item => targets.has(item.target));
      while (pending.length) {
        for (const supplement of pending) {
          const id = allocate(`${supplement.id}-${part.id}`);
          targets.set(supplement.id, id);
          state.supplements.push({ ...structuredClone(supplement), id,
            target: targets.get(supplement.target)!, splitFrom: supplement.id });
        }
        pending = input.supplements.filter(item => targets.has(item.target) && !targets.has(item.id));
      }
      // Keep original audit events and read markers; expose shared pre-split history to each part.
      for (const log of state.logs) {
        const inherited = [log.target, ...(log.relatedTargets ?? [])].flatMap(target => targets.has(target) ? [targets.get(target)!] : []);
        if (inherited.length) log.relatedTargets = [...new Set([...(log.relatedTargets ?? []), ...inherited])];
      }
    }
  }
  state.reviews = reviews;
  state.revision++;
  return state;
}
