import { describe, expect, it, vi } from 'vitest';

import { defineFunctions } from '../../functions/contract';
import { tasksOf } from '../../functions/tests/tasksOf';
import { createActionsModule } from '../index';
import { buildEntry, callTrigger, disabledEntry, lookups, node, request } from './tests/runAction';

import type { ActionRunError } from './errors';
import type { FunctionTask } from '../../functions/contract';
import type { ActionRunRecord } from '../types';
import type { ElementInteraction, SSRUser } from '@plitzi/sdk-shared';

const user = (permissions: string[]): SSRUser => ({
  token: 'secret-token',
  id: 7,
  username: 'ana',
  email: 'ana@example.com',
  verified: true,
  permissions,
  roles: []
});

describe('runAction', () => {
  it('answers exactly what the output step named', async () => {
    const { runAction } = createActionsModule({ lookups });

    const result = await runAction(request(buildEntry()));

    expect(result.status).toBe('completed');
    expect(result.output).toEqual({ total: 42, leaked: 'internal' });
    expect(result.trace).toHaveLength(1);
  });
  it('hands a task its params as the types it declares — a number written as text is the number', async () => {
    const seen: unknown[] = [];
    const task: FunctionTask<{ count: number; open: boolean; label: string }> = {
      namespace: 'test',
      action: 'typed',
      title: 'Typed',
      params: {
        count: { type: 'number', canBind: true, defaultValue: 1, label: 'Count' },
        open: { type: 'boolean', canBind: true, defaultValue: false, label: 'Open' },
        label: { type: 'text', canBind: true, defaultValue: '', label: 'Label' }
      },
      run: params => {
        seen.push(params);

        return Promise.resolve({});
      }
    };
    const { runAction } = createActionsModule({ lookups, functions: tasksOf(task) });
    const step = (params: Record<string, unknown>) =>
      buildEntry({
        nodes: {
          start: callTrigger({}, 'typed'),
          typed: node('typed', { action: 'test.typed', params, afterNode: 'out' }),
          out: node('out', { action: 'flow.output', params: { values: '{"ok": true}' } })
        }
      });

    await runAction(request(step({ count: '5', open: 'true', label: '7' })));
    await runAction(request(step({ count: ' ', open: 'false', label: '' })));

    expect(seen).toEqual([
      { count: 5, open: true, label: '7' },
      { count: 1, open: false, label: '' }
    ]);
  });
  it('refuses a call that breaks the rules a task declares, every one at once, before its code runs', async () => {
    const ran: unknown[] = [];
    const task: FunctionTask<{ title: string; seconds: number; note: string }> = {
      namespace: 'test',
      action: 'ruled',
      title: 'Ruled',
      params: {
        title: { type: 'text', canBind: true, label: 'Title', required: true, maxLength: 5 },
        seconds: { type: 'number', canBind: true, label: 'Seconds', min: 30, max: 300, defaultValue: 90 },
        note: { type: 'text', canBind: true, label: 'Note', required: true, defaultValue: 'none' }
      },
      run: params => {
        ran.push(params);

        return Promise.resolve({});
      }
    };
    const { runAction } = createActionsModule({ lookups, functions: tasksOf(task) });
    const step = (params: Record<string, unknown>) =>
      buildEntry({
        nodes: {
          start: callTrigger({}, 'ruled'),
          ruled: node('ruled', { action: 'test.ruled', params, afterNode: 'out' }),
          out: node('out', { action: 'flow.output', params: { values: '{"ok": true}' } })
        }
      });

    const refused = await runAction(request(step({ title: '  ', seconds: '999', note: '' })));
    const long = await runAction(request(step({ title: 'Too long', seconds: '45' })));
    await runAction(request(step({ title: 12, seconds: '' })));

    expect(refused.error).toBe('Title is required; Seconds is at most 300');
    expect(long.error).toBe('Title is longer than 5 characters');
    // A number bound to a text param arrives as its digits, and a required param with a default is never missing.
    expect(ran).toEqual([{ title: '12', seconds: 90, note: 'none' }]);
  });
  it('refuses past a rate limit with the words the task gave it, in a server of its own too', async () => {
    const task: FunctionTask<Record<string, never>> = {
      namespace: 'test',
      action: 'limited',
      title: 'Limited',
      params: {},
      run: async (_params, ctx) => ctx.rateLimit('make', { most: 1, perSeconds: 60, refuse: 'Wait a minute' })
    };
    const { runAction } = createActionsModule({ lookups, functions: tasksOf(task) });
    const entry = buildEntry({
      nodes: { start: callTrigger({}, 'limited'), limited: node('limited', { action: 'test.limited', params: {} }) }
    });

    expect((await runAction(request(entry))).status).toBe('completed');
    expect((await runAction(request(entry))).error).toBe('Wait a minute');
  });
  describe('when a step fails after the flow already did something', () => {
    /** Records what each step was asked to do, in order: the property under test is WHICH steps ran. */
    const recorder = () => {
      const labels: string[] = [];
      const task: FunctionTask<{ label: string }> = {
        namespace: 'test',
        action: 'record',
        title: 'Record',
        params: { label: { type: 'text', canBind: true, defaultValue: '', label: 'Label' } },
        run: ({ label }) => {
          labels.push(label);

          return Promise.resolve({ recorded: label });
        }
      };

      return { labels, task };
    };

    const record = (id: string, label: string, overrides: Partial<ElementInteraction> = {}) =>
      node(id, { action: 'test.record', params: { label }, ...overrides });

    /** take → (what happens next) → answer → On Failure → give back, only if the seats were taken. */
    const bookingEntry = (afterTake: Record<string, ElementInteraction>, first = 'take') =>
      buildEntry({
        nodes: {
          start: callTrigger({}, first),
          take: record('take', 'take seats', { afterNode: Object.keys(afterTake)[0] ?? 'out' }),
          ...afterTake,
          out: node('out', { action: 'flow.output', params: { values: '{"ok": true}' }, afterNode: 'undo' }),
          undo: node('undo', { action: 'flow.onFailure', afterNode: 'giveBack' }),
          giveBack: record('giveBack', 'give back after {{ failure.step }}: {{ failure.message }}', {
            when: { combinator: 'and', rules: [{ field: 'take.recorded', operator: '=', value: 'take seats' }] }
          })
        }
      });

    it('gives back what was taken, and still answers as failed', async () => {
      const { labels, task } = recorder();
      const { runAction } = createActionsModule({ lookups, functions: tasksOf(task) });
      const entry = bookingEntry({
        mail: node('mail', { action: 'flow.fail', params: { message: 'mail refused' }, afterNode: 'out' })
      });

      const result = await runAction(request(entry));

      expect(result.status).toBe('failed');
      expect(result.output).toEqual({});
      expect(labels).toEqual(['take seats', 'give back after mail: mail refused']);
      // The step that threw is where the flow broke, so it is recorded as failed before the run's error node.
      expect(result.trace.map(step => step.node.id)).toEqual(['take', 'mail', 'error', 'undo', 'giveBack']);
    });

    /**
     * What a debugger is told about a flow it may not read: which steps ran, how each ended, and which one broke.
     *
     * Never what a step was given or returned — those can hold another visitor's data, and they stay in the trace,
     * which only authoring and a development server ever receive.
     */
    it('outlines the run without what any step was given or returned', async () => {
      const { task } = recorder();
      const { runAction } = createActionsModule({ lookups, functions: tasksOf(task) });
      const entry = bookingEntry({
        mail: node('mail', { action: 'flow.fail', params: { message: 'mail refused' }, afterNode: 'out' })
      });

      const result = await runAction(request(entry));

      expect(result.steps.map(step => [step.id, step.status, step.phase])).toEqual([
        ['take', 'success', 'flow'],
        ['mail', 'failed', 'flow'],
        ['undo', 'success', 'undo'],
        ['giveBack', 'success', 'undo']
      ]);
      expect(result.steps.find(step => step.id === 'mail')?.error).toContain('mail refused');
      expect(result.steps.every(step => step.endTime >= step.startTime)).toBe(true);
      // The label the recorder was handed is in the trace and in no step of the outline.
      expect(JSON.stringify(result.steps)).not.toContain('take seats');
    });

    it('ends at On Failure when nothing failed', async () => {
      const { labels, task } = recorder();
      const { runAction } = createActionsModule({ lookups, functions: tasksOf(task) });

      const result = await runAction(request(bookingEntry({})));

      expect(result.status).toBe('completed');
      expect(result.output).toEqual({ ok: true });
      expect(labels).toEqual(['take seats']);
    });

    /** The failure came before anything was taken, so there is nothing to give back — and giving back is a write. */
    it('asks each undo step its own when', async () => {
      const { labels, task } = recorder();
      const { runAction } = createActionsModule({ lookups, functions: tasksOf(task) });
      const entry = bookingEntry(
        { check: node('check', { action: 'flow.fail', params: { message: 'no such day' }, afterNode: 'take' }) },
        'check'
      );
      entry.document.nodes.take.afterNode = 'out';

      const result = await runAction(request(entry));

      expect(result.status).toBe('failed');
      expect(labels).toEqual([]);
      expect(result.trace.find(step => step.node.id === 'giveBack')?.status).toBe('skipped');
    });

    it('keeps the failure it had when undoing fails too', async () => {
      const { task } = recorder();
      const onRun = vi.fn();
      const { runAction } = createActionsModule({ lookups, functions: tasksOf(task), onRun });
      const entry = bookingEntry({
        mail: node('mail', { action: 'flow.fail', params: { message: 'mail refused' }, afterNode: 'out' })
      });
      entry.document.nodes.giveBack = node('giveBack', { action: 'flow.fail', params: { message: 'store down' } });

      const result = await runAction(request(entry));

      expect(result.status).toBe('failed');
      const recorded = onRun.mock.calls[0][0] as ActionRunRecord;
      expect(recorded.error).toContain('mail refused');
      expect(recorded.error).toContain('store down');
    });

    /** A run that hit its deadline took its seats just the same, and its own clock is what ran out. */
    it('gives back what a run that hit its deadline took', async () => {
      const { labels, task } = recorder();
      const stuck: FunctionTask<Record<string, never>> = {
        namespace: 'test',
        action: 'stuck',
        title: 'Never returns',
        params: {},
        run: () => new Promise(() => undefined)
      };
      const { runAction } = createActionsModule({ lookups, functions: tasksOf(task, stuck) });
      const entry = bookingEntry({ hang: node('hang', { action: 'test.stuck', afterNode: 'out' }) });
      entry.document.limits = { timeoutMs: 40 };

      await expect(runAction(request(entry))).rejects.toMatchObject({ reason: 'timeout' });
      expect(labels).toEqual(['take seats', 'give back after hang: Action exceeded its 40ms budget']);
    });

    /**
     * A run that died has an outline too, and it is the one somebody most needs.
     *
     * The step that never returned settled nothing, so nothing would have recorded it — and a debugger would be shown
     * a flow that stopped after the step before it, which is the wrong step to go and look at.
     */
    it('names the step that was still running as where a dead run stopped', async () => {
      const { task } = recorder();
      const stuck: FunctionTask<Record<string, never>> = {
        namespace: 'test',
        action: 'stuck',
        title: 'Never returns',
        params: {},
        run: () => new Promise(() => undefined)
      };
      const { runAction } = createActionsModule({ lookups, functions: tasksOf(task, stuck) });
      const entry = bookingEntry({ hang: node('hang', { action: 'test.stuck', afterNode: 'out' }) });
      entry.document.limits = { timeoutMs: 40 };

      const error = (await runAction(request(entry)).catch((failure: unknown) => failure)) as ActionRunError;

      expect(error.steps?.map(step => [step.id, step.status])).toEqual([
        ['take', 'success'],
        ['hang', 'failed'],
        ['undo', 'success'],
        ['giveBack', 'success']
      ]);
      expect(error.steps?.find(step => step.id === 'hang')?.error).toContain('40ms budget');
    });
  });
  it('publishes the moment the run started as `now`', async () => {
    const { runAction } = createActionsModule({ lookups });
    const entry = buildEntry({
      nodes: {
        start: callTrigger(),
        compute: node('compute', { action: 'flow.output', params: { values: '{"now": "{{ now }}"}' } })
      }
    });
    const before = Date.now();

    const result = await runAction(request(entry));
    const now = String(result.output.now);

    expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Date.parse(now)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(now)).toBeLessThanOrEqual(Date.now());
  });
  /**
   * The stuck run this ceiling exists for.
   *
   * Aborting the controller is the polite half and covers a task that watches its signal. A task that does NOT —
   * a driver that takes no signal, a client that swallows it, a loop somebody wrote by accident — would otherwise
   * leave the run awaiting something that never returns, holding a caller, a slot and a connection with nothing
   * in the process able to tell it apart from work in progress.
   */
  it('ends a run whose step never returns, and says why', async () => {
    const stuck: FunctionTask<Record<string, never>> = {
      namespace: 'test',
      action: 'stuck',
      title: 'Never returns',
      params: {},
      // Deliberately ignores `ctx.signal`: that is the whole case.
      run: () => new Promise(() => undefined)
    };
    const entry = buildEntry({
      limits: { timeoutMs: 40 },
      nodes: {
        start: callTrigger({}, 'hang'),
        hang: node('hang', { action: 'test.stuck', afterNode: 'out' }),
        out: node('out', { action: 'flow.output', params: { values: '{}' } })
      }
    });
    const { runAction } = createActionsModule({ lookups, functions: tasksOf(stuck) });

    await expect(runAction(request(entry))).rejects.toMatchObject({ reason: 'timeout' });
  });
  /** A run that hit a ceiling is the one somebody has to be able to find afterwards — it used to leave nothing,
   *  because the refusal was rethrown before the record was written. */
  it('records a run that hit its deadline instead of vanishing', async () => {
    const onRun = vi.fn();
    const stuck: FunctionTask<Record<string, never>> = {
      namespace: 'test',
      action: 'stuck',
      title: 'Never returns',
      params: {},
      run: () => new Promise(() => undefined)
    };
    const entry = buildEntry({
      limits: { timeoutMs: 40 },
      nodes: {
        start: callTrigger({}, 'hang'),
        hang: node('hang', { action: 'test.stuck', afterNode: 'out' }),
        out: node('out', { action: 'flow.output', params: { values: '{}' } })
      }
    });
    const { runAction } = createActionsModule({ lookups, functions: tasksOf(stuck), onRun });

    await expect(runAction(request(entry))).rejects.toThrow(/40ms budget/);
    const recorded = onRun.mock.calls[0][0] as ActionRunRecord;
    expect(recorded.status).toBe('aborted');
    expect(recorded.error).toContain('40ms budget');
  });
  /** A document may only ever TIGHTEN what the deployment allows: an authored ceiling is customer input. */
  it('takes the tighter of the deployment’s budget and the document’s', async () => {
    const slow: FunctionTask<Record<string, never>> = {
      namespace: 'test',
      action: 'slow',
      title: 'Slow',
      params: {},
      run: () => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 200))
    };
    const entry = buildEntry({
      limits: { timeoutMs: 5_000 },
      nodes: {
        start: callTrigger({}, 'slow'),
        slow: node('slow', { action: 'test.slow', afterNode: 'out' }),
        out: node('out', { action: 'flow.output', params: { values: '{}' } })
      }
    });
    const { runAction } = createActionsModule({
      lookups,
      functions: tasksOf(slow),
      limits: { timeoutMs: 40 }
    });

    await expect(runAction(request(entry))).rejects.toThrow(/40ms budget/);
  });
  // The property that matters: the flow scope holds every step's raw result, and none of it reaches the caller
  // unless the output step names it.
  it('leaves everything the output step did not name on the server', async () => {
    const entry = buildEntry({
      nodes: {
        start: callTrigger({}, 'fetchish'),
        fetchish: node('fetchish', {
          action: 'transform.json',
          afterNode: 'out',
          params: { value: '{"public":"ok","internalToken":"tok_live_should_not_travel"}' }
        }),
        out: node('out', { action: 'flow.output', params: { values: '{"ok": "{{ fetchish.value.public }}"}' } })
      }
    });
    const { runAction } = createActionsModule({ lookups });

    const result = await runAction(request(entry));

    expect(result.output).toEqual({ ok: 'ok' });
    expect(JSON.stringify(result.output)).not.toContain('tok_live_should_not_travel');
  });
  it('refuses a trigger the document does not declare', async () => {
    const { runAction } = createActionsModule({ lookups });

    await expect(runAction(request(buildEntry(), { trigger: 'webhook' }))).rejects.toMatchObject({
      reason: 'forbidden'
    });
  });
  it('refuses a run through a trigger that is switched off', async () => {
    const { runAction } = createActionsModule({ lookups });

    await expect(runAction(request(disabledEntry()))).rejects.toMatchObject({ reason: 'disabled' });
  });
  it('refuses a run whose lineage already names the action', async () => {
    const { runAction } = createActionsModule({ lookups });

    await expect(runAction(request(buildEntry(), { lineage: ['quote'] }))).rejects.toMatchObject({
      reason: 'recursion'
    });
  });
  /** A list sent to a text field is nearly always JSON the page meant as text: the refusal says what takes it. */
  it('says what a value that does not fit its field is, and which type takes it', async () => {
    const { runAction } = createActionsModule({ lookups });
    const entry = buildEntry({
      nodes: {
        ...buildEntry().document.nodes,
        start: callTrigger({ input: '{"windows":{"type":"text","required":true}}' })
      }
    });

    await expect(runAction(request(entry, { input: { windows: ['a', 'b'] } }))).rejects.toMatchObject({
      reason: 'invalid_input',
      message: 'Invalid input: windows (text, got a list; declare the field `json` to take it)'
    });
  });
  /**
   * A task reading many sources catches a failed fetch and goes on — so the budget's refusal looked like a network
   * error, and nothing named the limit. The step that ran into it says so, and so does the server's log.
   */
  it('names the request budget in the step that ran out of it, even when the task caught the refusal', async () => {
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sweep: FunctionTask<Record<string, never>> = {
      namespace: 'test',
      action: 'sweep',
      title: 'Sweep',
      params: {},
      run: async (_params, context) => {
        const read = await Promise.all(
          ['a', 'b', 'c'].map(source =>
            context.fetch(`https://${source}.example/feed`).then(
              () => true,
              () => false
            )
          )
        );

        return { read: read.filter(Boolean).length };
      }
    };
    const { runAction } = createActionsModule({
      lookups,
      functions: {
        native: [defineFunctions({ allow: { hosts: ['a.example', 'b.example', 'c.example'] }, tasks: [sweep] })]
      },
      limits: { maxRequests: 1 },
      fetchImpl: () => Promise.resolve(new Response('ok'))
    });
    const entry = buildEntry({
      nodes: {
        start: callTrigger({}, 'sweep'),
        sweep: node('sweep', { action: 'test.sweep', afterNode: 'out' }),
        out: node('out', { action: 'flow.output', params: { values: '{"read": {{ sweep.read }}}' } })
      }
    });

    const result = await runAction(request(entry));

    expect(result.output).toEqual({ read: 1 });
    expect(result.steps.find(step => step.id === 'sweep')?.logs?.join(' ')).toContain('1 outbound request budget');
    expect(JSON.stringify(warnings.mock.calls)).toContain('maxRequests');
    warnings.mockRestore();
  });
  it('refuses missing required input', async () => {
    const { runAction } = createActionsModule({ lookups });

    await expect(runAction(request(buildEntry(), { input: {} }))).rejects.toMatchObject({ reason: 'invalid_input' });
  });
  it('requires the declared permissions', async () => {
    const entry = buildEntry({
      nodes: {
        start: callTrigger({ access: 'role', permissions: 'space.write' }),
        compute: node('compute', { action: 'flow.output', params: { values: '{"total": 1}' } })
      }
    });
    const { runAction } = createActionsModule({ lookups });

    // Two different refusals: nobody signed in has a session to renew, somebody short a permission does not.
    await expect(runAction(request(entry))).rejects.toMatchObject({ reason: 'unauthenticated' });
    await expect(runAction(request(entry, { user: user(['space.read']) }))).rejects.toMatchObject({
      reason: 'forbidden'
    });

    const granted = await runAction(request(entry, { user: user(['space.write']) }));
    expect(granted.status).toBe('completed');
  });
  it('skips a step whose `when` does not match, and keeps walking', async () => {
    const entry = buildEntry({
      nodes: {
        start: callTrigger({}, 'skipped'),
        skipped: node('skipped', {
          action: 'flow.fail',
          afterNode: 'compute',
          params: { message: 'never' },
          when: { combinator: 'and', rules: [{ field: 'input.amount', operator: '=', value: 0 }] } as never
        }),
        compute: node('compute', { action: 'flow.output', params: { values: '{"total": 1}' } })
      }
    });
    const { runAction } = createActionsModule({ lookups });

    const result = await runAction(request(entry));

    expect(result.trace.map(entryNode => entryNode.status)).toEqual(['skipped', 'success']);
    expect(result.output).toEqual({ total: 1 });
  });
});
