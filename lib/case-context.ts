import { activeAppeal, currentOwner, needsRead, needsWork, openSupplement, person, roleOf, terminalRemedy, type Entity, type Finding, type State } from './workflow.ts';
import { activeDeadline, alertDeadlineLabel } from './alert-deadlines.ts';

/** Display the responsibility of this stage, including parallel assignment and read-only acknowledgements. */
export function responsibilityContext(state: State, item: Entity) {
  const paused = 'pause' in item && !!item.pause;
  const readOnly = needsRead(state, item) && !needsWork(state, item);
  const assignment = 'standardSequence' in item && !terminalRemedy(item) && !paused && !item.inspector && item.origin === 'direct' && roleOf(state) === 'supervisor';
  const owner = person(readOnly || assignment ? state.identity : currentOwner(state, item));
  const badge = paused ? '申诉暂停' : readOnly ? '待确认知悉' : assignment ? '待指派核验人' : needsWork(state, item) ? '轮到我处理' : owner?.id === state.identity ? '当前负责' : owner ? '等待他人' : '无待办';
  return { owner, badge, readOnly, paused };
}

/** One current-stage clock for queues, responsibility cards, exports and reminders. */
export function currentTaskContext(state: State, item: Entity) {
  const responsibility = responsibilityContext(state, item);
  let dueAt:string|undefined;
  let deadlineLabel = '完成期限';
  if (!responsibility.readOnly && responsibility.owner) {
    if ('conclusions' in item) {
      if (item.distribution?.status === 'pending') {
        dueAt = item.distribution.responseDueAt;
        deadlineLabel = '回应期限';
      } else {
        dueAt = activeDeadline(item);
        deadlineLabel = alertDeadlineLabel(item);
      }
    } else if ('dueAt' in item) {
      dueAt = item.dueAt;
      deadlineLabel = 'standardSequence' in item ? '整改完成期限' : 'executor' in item ? '补件期限'
        : 'findingIds' in item ? item.type === 'appeal' ? '核查期限' : '复核完成期限' : '裁定期限';
      // The owner of a parent waiting for evidence is already the supplement owner.
      const supplement = state.supplements.find(sp => sp.target === item.id && openSupplement(sp));
      const appeal = 'findingIds' in item && item.appealId ? state.appeals.find(ap => ap.id === item.appealId) : undefined;
      const appealSupplement = appeal?.status === 'supplement' ? state.supplements.find(sp => sp.target === appeal.id && openSupplement(sp)) : undefined;
      const child = supplement ?? appealSupplement ?? ('findingId' in item && !('standardSequence' in item) && item.status === 'reviewing'
        ? state.reviews.find(review => review.id === item.reviewId && !['done','cancelled'].includes(review.status)) : undefined);
      if (child && !responsibility.paused) {
        dueAt = child.dueAt;
        deadlineLabel = 'executor' in child ? '补件期限' : '核查期限';
      }
    }
  }
  return {...responsibility, dueAt, deadlineLabel};
}

export function taskIsOverdue(state:State, item:Entity, now:number) {
  const {owner,readOnly,paused,dueAt} = currentTaskContext(state,item);
  return !!owner && !readOnly && !paused && !!dueAt && Date.parse(dueAt) <= now;
}

/** Original distribution is historical during appeals; remedy pages use the current round's requirements. */
export function distributionContext(state: State, item: Entity, finding?: Finding) {
  const distribution = finding?.distribution;
  if (!distribution) return undefined;
  if ('standardSequence' in item) return {
    ...distribution, title: '本轮整改要求', goal: item.goal, standard: item.standard,
    observation: item.observation, sampleCount: item.sampleCount, dueAt: item.dueAt,
    inspector: person(item.inspector)?.name ?? (item.materials.length ? '待主管指派，已提交资料保留' : '待主管指派，可先提交整改资料'), guidance: '',
  };
  const appeal = 'findingId' in item ? state.appeals.find(a => a.id === item.id)
    : 'findingIds' in item && item.appealId ? state.appeals.find(a => a.id === item.appealId)
    : finding ? activeAppeal(state, finding.id) : undefined;
  const historical = !!appeal || distribution.status !== 'pending';
  return {
    ...distribution, title: historical ? '原处理结果与整改要求' : '处理结果与整改要求',
    inspector: person(distribution.inspector)?.name ?? (historical ? '原分发时未指定' : '接受整改后由主管补派，可先整改'),
    guidance: appeal ? ['done', 'withdrawn', 'rejected'].includes(appeal.status) ? '原分发要求保留供追溯，后续办理以裁定结果和当前任务为准。' : '当前按申诉流程办理；不成立后进入整改并沿用本案核查质检员，无需再次接受或补派。'
      : distribution.status === 'pending' ? '查看或确认知悉不会代替接受；请明确选择接受整改或提出申诉。' : '原分发要求保留供追溯，当前要求以关联整改任务为准。',
  };
}

/** Read the original return event for persisted records created before the dedicated field. */
export function supervisorReturnNote(state: State, item: Entity): string | undefined {
  if ('supervisorComment' in item && item.supervisorComment?.trim()) return item.supervisorComment;
  if (!('findingIds' in item) && !('standardSequence' in item)) return undefined;
  const appeal = 'findingIds' in item && item.type === 'appeal';
  const target = appeal ? item.appealId : item.id;
  const names = 'standardSequence' in item || appeal
    ? ['退回质检员核对'] : ['退回复核', '退回重新核实', '退回重新抽检'];
  return state.logs.filter(log => log.target === target && person(log.actor)?.role === 'supervisor' && names.includes(log.action) && log.note?.trim())
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]?.note;
}
