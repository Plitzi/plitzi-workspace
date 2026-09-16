import { describeTarget, expect, test } from '../../../fixtures';
import { ACTION_IDS, ACTION_OUTPUT, FEED_ACTION } from '../../../spaces';

import type { APIRequestContext } from '@playwright/test';

/**
 * Who is told what the flows behind a page did — and who is told nothing.
 *
 * Three ways a page can be authorized to debug: the deployment says so (`debugMode`), it is a development server
 * (`devMode`), or the space switched dev tools on for its own site. `debugging.spec.ts` covers the dev server; this
 * covers the other two answers, against pages served the way a real site is.
 *
 * The rule being pinned is not "secrets are redacted" — the runner's own tests cover that. It is that a page nobody
 * authorized learns NOTHING about the flow behind an answer: not the steps, not the tasks they ran, not the host one
 * of them could not reach, not even that a flow ran at all.
 */

type RunAnswer = { status: string; output?: Record<string, unknown>; steps?: unknown[]; trace?: unknown[] };

/** Everything a step may carry. Anything else on one is data that escaped — see the outline test below. */
const STEP_FIELDS = new Set(['id', 'title', 'action', 'status', 'phase', 'startTime', 'endTime', 'error']);
type RscAnswer = { serverData?: Record<string, unknown>; actionRuns?: unknown[] };

const call = (request: APIRequestContext, origin: string, actionId: string, input: Record<string, string> = {}) =>
  request.post(`${origin}/_action`, { data: { actionId, input } });

const rsc = (request: APIRequestContext, origin: string, ids: string) =>
  request.get(`${origin}/_rsc?location=%2F&ids=${ids}`);

describeTarget('published-server', subject => {
  test('a call answers its result and nothing about the flow that produced it', async ({ request }) => {
    const response = await call(request, subject.origin, FEED_ACTION.id, { who: 'ana' });
    const answer = (await response.json()) as RunAnswer;

    expect(response.status()).toBe(200);
    expect(answer.status, 'the run itself must still work').toBe('completed');
    expect(answer.output).toMatchObject({ who: 'ana' });
    expect(answer.steps, 'a published site sent the step outline').toBeUndefined();
    expect(answer.trace, 'a published site sent the full trace').toBeUndefined();
  });

  test('the page carries no record of the runs that built it', async ({ request }) => {
    const html = await (await request.get(subject.origin)).text();

    // The section itself still rendered: this is about what the page is TOLD, not about what it can do.
    expect(html).toContain(ACTION_OUTPUT.title);
    expect(html).not.toContain('actionRuns');
  });

  test('a refresh answers data and no runs', async ({ request }) => {
    const answer = (await (await rsc(request, subject.origin, ACTION_IDS.provider)).json()) as RscAnswer;

    expect(answer.serverData?.[ACTION_IDS.provider]).toMatchObject(ACTION_OUTPUT);
    expect(answer.actionRuns).toBeUndefined();
  });

  /**
   * The empty section, and what a stranger may learn from it.
   *
   * The flow behind it dials a host that does not exist. The page says the provider could not be reached — that is
   * the element's own error state, which an author binds on purpose — and nowhere does it name the step, the task
   * it ran, or the address it tried.
   */
  test('a section that failed names neither the step nor the host it could not reach', async ({ request }) => {
    const html = await (await request.get(subject.origin)).text();
    const refresh = await (await rsc(request, subject.origin, ACTION_IDS.offline)).text();

    for (const body of [html, refresh]) {
      expect(body).not.toContain('offline.invalid');
      expect(body).not.toContain('http.request');
      expect(body).not.toContain('actionRuns');
    }
  });

  /** A refusal is still an answer, and it is the one place a stack of internals used to leak out. */
  test('an unknown action is refused without describing the space', async ({ request }) => {
    const response = await call(request, subject.origin, 'no-such-action');
    const body = await response.text();

    expect(response.status()).toBe(404);
    expect(body).not.toContain('steps');
    expect(body).not.toContain(FEED_ACTION.id);
  });
});

describeTarget('devtools-server', subject => {
  /** The owner switched dev tools on for their own published site: that buys the OUTLINE of what the flow did. */
  test('a space that switched dev tools on is told what its flow did', async ({ request }) => {
    const answer = (await (await call(request, subject.origin, FEED_ACTION.id)).json()) as RunAnswer;
    const steps = answer.steps as { id: string; action: string; status: string; phase: string }[] | undefined;

    expect(steps?.map(step => [step.id, step.action, step.status, step.phase])).toEqual([
      ['hold', 'flow.delay', 'success', 'flow'],
      ['answer', 'flow.output', 'success', 'flow']
    ]);
  });

  /**
   * The line the outline exists to respect.
   *
   * It says which steps ran and how they ended. What any of them was GIVEN or ANSWERED stays on the server — a
   * result can hold another visitor's data — and that half only ever reaches an authoring request or a dev server.
   */
  test('the outline carries nothing a step was given or answered', async ({ request }) => {
    // Input of its own: single-flight keys on the caller and the input, so repeating the call above from the same
    // address would be refused as a duplicate — and a refusal has no steps to inspect. It also gives this test a
    // value that goes in and comes back out, which is exactly what must not appear in the outline.
    const who = 'not-for-the-outline';
    const response = await call(request, subject.origin, FEED_ACTION.id, { who });
    const answer = (await response.json()) as RunAnswer;
    const steps = (answer.steps ?? []) as Record<string, unknown>[];

    expect(response.status(), 'the run never happened, so there is nothing to inspect').toBe(200);
    expect(answer.trace, 'a published site sent the full trace').toBeUndefined();
    expect(steps.length).toBeGreaterThan(0);

    // Field by field rather than by searching the JSON for a value: a timestamp can contain any digits, so a search
    // that passes does not tell you whether the door is shut.
    for (const step of steps) {
      expect(
        Object.keys(step).filter(field => !STEP_FIELDS.has(field)),
        'a step carried more than it may'
      ).toEqual([]);
    }

    expect(JSON.stringify(steps), 'a step parameter travelled in the outline').not.toContain(who);
    expect(JSON.stringify(steps), 'a step result travelled in the outline').not.toContain(ACTION_OUTPUT.title);
  });

  test('the render runs reach the page, named after the element each one fed', async ({ request }) => {
    const answer = (await (await rsc(request, subject.origin, ACTION_IDS.provider)).json()) as RscAnswer;
    const runs = answer.actionRuns as { actionId: string; trigger: string; elementId: string }[] | undefined;

    expect(runs?.[0]).toMatchObject({
      actionId: FEED_ACTION.id,
      trigger: 'render',
      elementId: ACTION_IDS.provider
    });
  });

  test('the page is seeded with them too, so the panel has them before any refresh', async ({ request }) => {
    const html = await (await request.get(subject.origin)).text();

    expect(html).toContain('actionRuns');
    expect(html).toContain('"trigger":"render"');
  });

  /** Even here: an answer carrying this request's own runs must not be served to the next visitor. */
  test('an answer that carries render runs is never cached', async ({ request }) => {
    const response = await rsc(request, subject.origin, ACTION_IDS.provider);

    expect(response.headers()['x-cache']).not.toBe('HIT');
  });
});
