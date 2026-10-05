import { describe, expect, it } from 'vitest';

import { answerAction } from './answerAction';

import type { AnsweredRoute, RoutingPage } from './answerAction';

type Outcome = { fulfilled?: { contentType?: string; body: string }; fellBack: boolean };

/** A page that routes one request through whatever handler was registered, and says what became of it. */
const pageWith = () => {
  const handlers: { url: string; handler: (route: AnsweredRoute) => Promise<void> }[] = [];
  const page: RoutingPage = {
    route: (url, handler) => {
      handlers.push({ url, handler });

      return Promise.resolve();
    }
  };
  const send = async (body: unknown, { method = 'POST', accept = '' } = {}): Promise<Outcome> => {
    const outcome: Outcome = { fellBack: false };
    const route: AnsweredRoute = {
      request: () => ({
        method: () => method,
        postData: () => (typeof body === 'string' ? body : JSON.stringify(body)),
        headers: (): Record<string, string> => (accept ? { accept } : {})
      }),
      fulfill: response => {
        outcome.fulfilled = response;

        return Promise.resolve();
      },
      fallback: () => {
        outcome.fellBack = true;

        return Promise.resolve();
      }
    };
    await handlers[0].handler(route);

    return outcome;
  };

  return { page, send, handlers };
};

describe('answerAction', () => {
  it('answers the action it names as a completed run, on the server’s action path', async () => {
    const { page, send, handlers } = pageWith();
    await answerAction(page, 'world-workspace', { windows: [] });

    const outcome = await send({ actionId: 'world-workspace', input: { op: 'load' } });

    expect(handlers[0].url).toBe('**/_action');
    expect(outcome.fulfilled?.contentType).toBe('application/json');
    expect(JSON.parse(outcome.fulfilled?.body ?? '')).toEqual({
      runId: 'test-world-workspace',
      status: 'completed',
      output: { windows: [] }
    });
  });

  it('answers from the input the page sent', async () => {
    const { page, send } = pageWith();
    await answerAction(page, 'search', input => ({ echoed: input.query }));

    const outcome = await send({ actionId: 'search', input: { query: 'quake' } });

    expect(JSON.parse(outcome.fulfilled?.body ?? '')).toMatchObject({ output: { echoed: 'quake' } });
  });

  it('lets every other call through: another action, a connector write, anything not a call', async () => {
    const { page, send } = pageWith();
    await answerAction(page, 'search', {});

    expect((await send({ actionId: 'save' })).fellBack).toBe(true);
    expect((await send({ elementId: 'list', action: 'create' })).fellBack).toBe(true);
    expect((await send('not json')).fellBack).toBe(true);
    expect((await send({ actionId: 'search' }, { method: 'GET' })).fellBack).toBe(true);
  });

  it('ends a streaming step with the one frame a finished run sends', async () => {
    const { page, send } = pageWith();
    await answerAction(page, 'report', { rows: 3 });

    const outcome = await send({ actionId: 'report' }, { accept: 'text/event-stream' });

    expect(outcome.fulfilled?.contentType).toBe('text/event-stream');
    expect(outcome.fulfilled?.body).toBe(
      `event: done\ndata: ${JSON.stringify({ runId: 'test-report', status: 'completed', output: { rows: 3 } })}\n\n`
    );
  });

  it('follows an action path the server moved', async () => {
    const { page, handlers } = pageWith();
    await answerAction(page, 'search', {}, { path: '/api/actions' });

    expect(handlers[0].url).toBe('**/api/actions');
  });
});
