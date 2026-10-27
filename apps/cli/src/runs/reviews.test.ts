import { describe, expect, it } from 'vitest';

import {
  letGoStep,
  maySayStep,
  nextStep,
  REVIEW_QUEUE_MS,
  reviewAtComplete,
  reviewFor,
  reviewSteps,
  stepReviewers,
  stepTimedOut,
  stepTimeOf
} from './reviews';

import type { RunTask, TaskState } from './model';
import type { ReviewState, ReviewTeam } from './reviews';
import type { TaskView } from './taskStore';

// Carlos: the run is a kanban — one review for every card, its steps the roles its card names, in order.

const T0 = Date.parse('2026-10-27T10:00:00Z');
const at = (minutes: number): string => new Date(T0 + minutes * 60_000).toISOString();

const card = (id: string, extra: Partial<RunTask> = {}): RunTask => ({
  id,
  title: id,
  kind: 'work',
  files: [`src/space/pages/${id}.ts`],
  dependsOn: [],
  priority: 'medium',
  estimateMinutes: 10,
  acceptance: [],
  ...extra
});

const inReview = (task: RunTask, review: Partial<ReviewState> = {}, worked: string[] = ['dev-1']): TaskView => {
  const state: TaskState = {
    status: 'in-review',
    round: 0,
    notes: worked.map(agent => ({ at: at(0), by: agent, kind: 'taken' as const, text: 'Taken' })),
    updatedAt: at(0),
    review: { round: 0, step: 0, since: at(0), ...review }
  };

  // Only what the review reads of a view: its card, its state, who holds it.
  return { task, state, owner: { agent: worked[0] ?? 'dev-1' } } as unknown as TaskView;
};

const team: ReviewTeam = {
  byRole: { developer: ['dev-1', 'dev-2'], designer: ['design-1'], tester: ['test-1'] },
  developers: ['dev-1', 'dev-2']
};
const noTester: ReviewTeam = {
  byRole: { developer: ['dev-1', 'dev-2'], designer: ['design-1'] },
  developers: ['dev-1', 'dev-2']
};

describe('a card’s review', () => {
  it('goes through the roles its card names, in order — a tester when it names none, the lead in a team without one', () => {
    expect(reviewSteps(card('t-a', { review: ['designer', 'tester'] }), team)).toEqual(['designer', 'tester']);
    expect(reviewSteps(card('t-a'), team)).toEqual(['tester']);
    expect(reviewSteps(card('t-a'), noTester)).toEqual(['lead']);
  });

  it('reviews for QA still where the role it names is nobody’s in the team: the default reviewer stands for it', () => {
    expect(reviewSteps(card('t-a', { review: ['designer', 'tester'] }), noTester)).toEqual(['designer', 'lead']);
    expect(reviewSteps(card('t-a', { review: ['writer', 'tester'] }), team)).toEqual(['tester']);
  });

  it('is the lead’s for a research card', () => {
    expect(reviewSteps(card('s-a', { files: [], spike: 'what the scope takes' }), team)).toEqual(['lead']);
  });
});

describe('who says a step', () => {
  const views = [inReview(card('t-a'))];

  it('is an agent of its role that did not work the card — else a developer that did not — else the lead', () => {
    expect(stepReviewers(views[0], views, 'tester', team)).toEqual(['test-1']);
    const testerWorked = inReview(card('t-a'), {}, ['test-1']);
    expect(stepReviewers(testerWorked, [testerWorked], 'tester', team)).toEqual(['dev-1', 'dev-2']);
    const everyoneWorked = inReview(card('t-a'), {}, ['test-1', 'dev-1', 'dev-2']);
    expect(stepReviewers(everyoneWorked, [everyoneWorked], 'tester', team)).toEqual(['lead']);
  });

  it('is never one that worked what a card of tests tests', () => {
    const tested = inReview(card('t-a'), {}, ['dev-1']);
    tested.state.status = 'done';
    const tests = inReview(card('t-a-tests', { testsOf: ['t-a'] }), {}, ['dev-2']);
    expect(stepReviewers(tests, [tested, tests], 'designer', { byRole: {}, developers: ['dev-1', 'dev-2'] })).toEqual([
      'lead'
    ]);
  });

  it('is the next step’s reviewer too, once nobody took it in time', () => {
    const view = inReview(card('t-a', { review: ['designer', 'tester'] }));
    expect(maySayStep(view, [view], 'test-1', team, T0)).toBe(false);
    expect(maySayStep(view, [view], 'test-1', team, T0 + REVIEW_QUEUE_MS)).toBe(true);
    expect(maySayStep(view, [view], 'design-1', team, T0)).toBe(true);
  });
});

describe('the review offered', () => {
  it('is the step it may say and take — the one it said the round before first — and the lead’s only where it is the lead’s', () => {
    const a = inReview(card('t-a'), { since: at(1) });
    const b = inReview(card('t-b'), { since: at(2), before: ['test-1'] });
    expect(reviewFor([a, b], 'test-1', team, T0)?.task.id).toBe('t-b');
    expect(reviewFor([a, b], 'lead', team, T0)).toBeUndefined();
    expect(reviewFor([a], 'lead', noTester, T0)?.task.id).toBe('t-a');
    const taken = inReview(card('t-c'), { by: 'test-2', at: at(0) });
    expect(
      reviewFor([taken], 'test-1', { ...team, byRole: { ...team.byRole, tester: ['test-1', 'test-2'] } }, T0)
    ).toBeUndefined();
  });
});

describe('a step’s time and order', () => {
  it('is its reviewer’s for its time — more on its first review of the run — then another’s', () => {
    const review: ReviewState = { round: 0, step: 0, since: at(0), by: 'test-1', at: at(0) };
    expect(stepTimedOut(review, T0 + stepTimeOf(review) - 1)).toBeUndefined();
    expect(stepTimedOut(review, T0 + stepTimeOf(review) + 60_000)).toBe(9);
    expect(stepTimeOf({ first: true })).toBeGreaterThan(stepTimeOf(undefined));
  });

  it('goes to the next step once approved, and is approved after its last — who said each kept for the next round', () => {
    const review: ReviewState = { round: 1, step: 0, since: at(0), by: 'design-1', at: at(1) };
    const next = nextStep(review, ['designer', 'tester'], at(5));
    expect(next).toEqual({ review: { round: 1, step: 1, since: at(5), before: ['design-1'] } });
    expect(nextStep({ ...review, step: 1, by: 'test-1' }, ['designer', 'tester'], at(6))).toEqual({ approved: true });
  });

  it('starts again from its first step each round, who held a step let go as the one before', () => {
    const sentBack = letGoStep({ round: 0, step: 1, since: at(0), by: 'test-1', at: at(2), before: ['design-1'] });
    expect(sentBack).toEqual({ round: 0, step: 1, since: at(0), before: ['design-1', 'test-1'] });
    const state = { status: 'changes-requested', round: 1, notes: [], updatedAt: at(3), review: sentBack } as TaskState;
    expect(reviewAtComplete(state, at(9))).toEqual({ round: 1, step: 0, since: at(9), before: ['design-1', 'test-1'] });
  });
});
