import { createHash } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FunctionFailure } from '@plitzi/sdk-shared/functions';

import type {
  FunctionInvocation,
  FunctionLimits,
  FunctionRunner,
  FunctionsBundleRef,
  FunctionUsage
} from '@plitzi/sdk-shared/functions';

/**
 * What every {@link FunctionRunner} does, written once and run against each one Plitzi ships — the sandbox in this
 * process (`createIsolateRunner`), the runner service through its socket (`createRemoteRunner`) and a runtime's own
 * process (`createRuntimeRunner`). The engine reads none of them by name: what it relies on is here, so a runner that
 * passes this is one the engine runs code on — a cloud's included.
 *
 * Each case names a task's body; the subject turns it into what its runner runs (a bundle the sandbox loads, the
 * definition a runtime was started with).
 */

export type RunnerSubject = {
  runner: FunctionRunner;
  bundle: FunctionsBundleRef;
  close: () => Promise<void>;
};

export type RunnerTraits = {
  /**
   * Holds the code to its limits — its CPU, time, calls and output. The sandbox does; a runtime's own process holds none
   * but the platform's clock, the process being the space's alone.
   */
  limited: boolean;
};

/** A module whose default export declares one task, `probe.run`, of the body given. */
export const probeModule = (body: string): string =>
  `export default { tasks: [{ namespace: 'probe', action: 'run', title: 'Probe', params: {}, run: async (params, ctx) => { ${body} } }] };`;

export const bundleOfCode = (code: string): FunctionsBundleRef => ({
  id: createHash('sha256').update(code).digest('hex'),
  load: () => Promise.resolve(code)
});

const LIMITS: FunctionLimits = { cpuMs: 300, wallMs: 3000, memoryMb: 64, outputBytes: 65_536, calls: 20 };

const invocation = (params: Record<string, unknown> = {}): FunctionInvocation => ({
  kind: 'task',
  name: 'probe.run',
  params,
  context: { spaceId: 1, environment: 'main', runId: 'contract', trigger: 'call', callerId: 'ip:127.0.0.1' }
});

type Asked = {
  params?: Record<string, unknown>;
  limits?: Partial<FunctionLimits>;
  answer?: (call: unknown) => Promise<unknown>;
  signal?: AbortSignal;
  onUsage?: (usage: FunctionUsage) => void;
};

/** What an invocation came to: the value it returned, or why it did not. */
type Outcome = { value: unknown } | { reason: string; message: string };

const answerNothing = (): Promise<unknown> => Promise.resolve(null);

export const describeFunctionRunner = (
  name: string,
  open: (code: string) => Promise<RunnerSubject>,
  traits: RunnerTraits
): void => {
  describe(`${name} — the function runner contract`, () => {
    const opened: RunnerSubject[] = [];

    const run = async (body: string, asked: Asked = {}): Promise<Outcome> => {
      const subject = await open(probeModule(body));
      opened.push(subject);
      try {
        return {
          value: await subject.runner.invoke({
            bundle: subject.bundle,
            invocation: invocation(asked.params),
            limits: { ...LIMITS, ...asked.limits },
            answer: asked.answer ?? answerNothing,
            signal: asked.signal ?? new AbortController().signal,
            ...(asked.onUsage ? { onUsage: asked.onUsage } : {})
          })
        };
      } catch (error) {
        return error instanceof FunctionFailure
          ? { reason: error.reason, message: error.message }
          : { reason: 'not a FunctionFailure', message: String(error) };
      }
    };

    beforeAll(() => {
      opened.length = 0;
    });

    afterAll(async () => {
      await Promise.all(opened.map(subject => subject.close()));
    });

    it('answers what the task returned, from the params it was handed', async () => {
      expect(await run('return { twice: params.n * 2 };', { params: { n: 21 } })).toEqual({ value: { twice: 42 } });
    });

    it('hands each call the code makes to answer, as the code made it, and the answer back to the code', async () => {
      const calls: unknown[] = [];
      const outcome = await run("return { read: await ctx.kv.get('hits') };", {
        answer: call => {
          calls.push(call);

          return Promise.resolve(7);
        }
      });

      expect(outcome).toEqual({ value: { read: 7 } });
      expect(calls).toEqual([{ op: 'kv', method: 'get', args: ['hits'] }]);
    });

    it('hands the code a call the platform refused, as an error it can catch', async () => {
      const outcome = await run(
        "try { await ctx.kv.get('hits'); return 'answered'; } catch (error) { return 'caught: ' + error.message; }",
        { answer: () => Promise.reject(new Error('No such store')) }
      );

      expect(outcome).toEqual({ value: expect.stringContaining('caught:') as unknown });
    });

    it('says a line the code logs as a call, never failing the code for it', async () => {
      const calls: unknown[] = [];
      const outcome = await run("ctx.log('hello', 3); return 'logged';", {
        answer: call => {
          calls.push(call);

          return Promise.resolve(null);
        }
      });

      expect(outcome).toEqual({ value: 'logged' });
      expect(calls).toContainEqual(expect.objectContaining({ op: 'log' }));
    });

    it('ends with an error the code threw as `error`, and its words', async () => {
      expect(await run("throw new Error('the ledger is closed');")).toEqual({
        reason: 'error',
        message: expect.stringContaining('the ledger is closed') as unknown
      });
    });

    it('ends when its signal is aborted, as `aborted`', async () => {
      const controller = new AbortController();
      setTimeout(() => {
        controller.abort('stopped by the platform');
      }, 50);

      expect(
        await run('await new Promise(() => {});', { signal: controller.signal, limits: { wallMs: 5000 } })
      ).toEqual({ reason: 'aborted', message: expect.any(String) as unknown });
    });

    it('says what the invocation spent before it settles', async () => {
      const spent: FunctionUsage[] = [];
      const outcome = await run("await ctx.kv.get('a'); return 'done';", { onUsage: usage => spent.push(usage) });

      expect(outcome).toEqual({ value: 'done' });
      expect(spent).toHaveLength(1);
      expect(spent[0]).toMatchObject({ calls: expect.any(Number) as unknown, wallMs: expect.any(Number) as unknown });
    });

    describe.skipIf(!traits.limited)('its limits', () => {
      // Its time is its own: CPU, and what it waits on that it asked for — a sleep, a call. A sleep past its time is
      // stopped at it.
      it('stops code past its time, as `wall`', async () => {
        expect(
          await run("await new Promise(resolve => setTimeout(resolve, 3000)); return 'woke';", {
            limits: { wallMs: 100 }
          })
        ).toMatchObject({ reason: 'wall' });
      });

      it('stops code past its CPU, as `cpu`', async () => {
        expect(await run('for (;;) {}', { limits: { cpuMs: 50, wallMs: 3000 } })).toMatchObject({ reason: 'cpu' });
      });

      it('stops code past its calls, as `calls`', async () => {
        expect(
          await run("for (let i = 0; i < 10; i++) { await ctx.kv.get('k' + i); } return 'all';", {
            limits: { calls: 3 }
          })
        ).toMatchObject({ reason: 'calls' });
      });

      it('refuses an answer past its output, as `output`', async () => {
        expect(await run("return 'x'.repeat(4096);", { limits: { outputBytes: 1024 } })).toMatchObject({
          reason: 'output'
        });
      });
    });
  });
};
