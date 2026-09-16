import { describeTarget, expect, test } from '../../../fixtures';
import { ACTION_IDS, ACTION_OUTPUT, FEED_ACTION, UNREACHABLE_ACTION } from '../../../spaces';

import type { APIRequestContext } from '@playwright/test';

/**
 * What a page is told about the flows behind it.
 *
 * A run reports an OUTLINE — the steps it took, how each ended, where it broke — to any page whose debugging the
 * deployment authorizes, and that is what the dev-tools draw. The runs the SERVER started while building the page
 * are the ones nothing else can see: nobody in the browser called them, so the render and the `/_rsc` answer are
 * the only place they can arrive.
 */

type RunStep = { id: string; title: string; action: string; status: string; phase: string; error?: string };

/** Everything a step may carry, and the whole of it. */
const STEP_FIELDS = new Set(['id', 'title', 'action', 'status', 'phase', 'startTime', 'endTime', 'error']);
type RunAnswer = { status: string; steps?: RunStep[]; trace?: unknown[] };
type RenderRun = { actionId: string; trigger: string; status: string; elementId?: string; steps: RunStep[] };

describeTarget('action-server', subject => {
  const call = async (request: APIRequestContext, actionId: string, input: Record<string, string> = {}) => {
    const response = await request.post(`${subject.origin}/_action`, { data: { actionId, input } });

    return (await response.json()) as RunAnswer;
  };

  const rscRuns = async (request: APIRequestContext, ids: string) => {
    const response = await request.get(`${subject.origin}/_rsc?location=%2F&ids=${ids}`);
    const { actionRuns } = (await response.json()) as { actionRuns?: RenderRun[] };

    return actionRuns ?? [];
  };

  test('a call reports the steps it ran, in the order it ran them', async ({ request }) => {
    const answer = await call(request, FEED_ACTION.id, { who: 'ana' });

    expect(answer.status).toBe('completed');
    expect(answer.steps?.map(step => [step.id, step.status, step.phase])).toEqual([
      ['hold', 'success', 'flow'],
      ['answer', 'success', 'flow']
    ]);
  });

  /** A step names the task it ran, which is what tells an author "this is the HTTP call" from the panel alone. */
  test('each step names the task behind it', async ({ request }) => {
    const answer = await call(request, FEED_ACTION.id);

    expect(answer.steps?.map(step => step.action)).toEqual(['flow.delay', 'flow.output']);
  });

  /**
   * The run nobody in the browser started.
   *
   * The action feeds a `runtime: 'server'` element, so it ran while the page was being built — and a page that may
   * debug it is handed the account of it, named after the element it fed.
   */
  test('the render reports the runs it started to build the page', async ({ request }) => {
    const runs = await rscRuns(request, ACTION_IDS.provider);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      actionId: FEED_ACTION.id,
      trigger: 'render',
      status: 'completed',
      elementId: ACTION_IDS.provider
    });
    expect(runs[0].steps.map(step => step.id)).toEqual(['hold', 'answer']);
  });

  /** The empty section, explained: which step could not be reached, rather than a section that resolved to nothing. */
  test('a render run that failed reports the step that broke it', async ({ request }) => {
    const runs = await rscRuns(request, ACTION_IDS.offline);
    const failed = runs.find(run => run.actionId === UNREACHABLE_ACTION.id);

    expect(failed, 'the failed render run was not reported').toBeDefined();
    expect(failed?.status).toBe('failed');
    const broke = failed?.steps.find(step => step.status === 'failed');
    expect(broke?.id).toBe('fetch');
    expect(broke?.error, 'the step failed without saying why').toBeTruthy();
  });

  /** An answer carrying this request's own runs is this request's alone: serving it to the next visitor would hand
   *  them somebody else's debugging session, and a stale one at that. */
  test('an answer that carries render runs is never cached', async ({ request }) => {
    const response = await request.get(`${subject.origin}/_rsc?location=%2F&ids=${ACTION_IDS.provider}`);

    expect(response.headers()['x-cache']).not.toBe('HIT');
  });

  /**
   * What the outline is allowed to carry, on the server that carries the most.
   *
   * Even here — a dev server, which also sends the full trace — the STEPS themselves hold only what ran and how it
   * went. A client reading `steps` gets the same shape on every deployment, so nothing that leaks into it would be
   * noticed only in production.
   */
  test('the outline carries nothing a step was given or answered', async ({ request }) => {
    // A value that goes in as input and comes back in the output, so anything carrying either would show it.
    const who = 'not-for-the-outline';
    const answer = await call(request, FEED_ACTION.id, { who });
    const steps = (answer.steps ?? []) as Record<string, unknown>[];

    expect(answer.trace, 'a dev server withheld the trace it is meant to send').toBeDefined();
    for (const step of steps) {
      expect(
        Object.keys(step).filter(field => !STEP_FIELDS.has(field)),
        'a step carried more than it may'
      ).toEqual([]);
    }

    expect(JSON.stringify(steps)).not.toContain(who);
    expect(JSON.stringify(steps), 'a step result travelled in the outline').not.toContain(ACTION_OUTPUT.title);
  });

  /** The page itself is seeded with them, so the panel has the render runs before anything is refreshed. */
  test('the rendered page carries the runs that built it', async ({ request }) => {
    const html = await (await request.get(subject.origin)).text();

    expect(html).toContain('actionRuns');
    expect(html).toContain('"trigger":"render"');
  });
});
