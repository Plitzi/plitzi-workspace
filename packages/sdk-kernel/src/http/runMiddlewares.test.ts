import { describe, expect, it } from 'vitest';

import { runMiddlewares } from './runMiddlewares';

import type { SSRMiddleware, SSRRequest, SSRResponseHelpers } from '../types';

const request = () => ({ ctx: {} }) as unknown as SSRRequest;
const response = {} as SSRResponseHelpers;

const waits =
  (ms: number): SSRMiddleware =>
  async (_req, _res, next) => {
    await new Promise(resolve => setTimeout(resolve, ms));
    await next();
  };

describe('runMiddlewares', () => {
  // The chain's own time per middleware: what each one waited for before it handed on, not the ones after it. The one
  // after waits far longer, so a time that took it in (230 ms or more) is told apart from one that did not however
  // loaded the machine is.
  it('times each middleware until it hands on, not the chain after it', async () => {
    const timed: [number, number][] = [];
    await runMiddlewares([waits(30), waits(200)], request(), response, (index, ms) => timed.push([index, ms]));

    expect(timed.map(([index]) => index)).toEqual([0, 1]);
    expect(timed[0][1]).toBeGreaterThanOrEqual(25);
    expect(timed[0][1]).toBeLessThan(200);
    expect(timed[1][1]).toBeGreaterThanOrEqual(195);
  });

  it('times a middleware that ends the chain until it ends it', async () => {
    const timed: number[] = [];
    const stopped = await runMiddlewares([() => undefined, waits(5)], request(), response, index => timed.push(index));

    expect(stopped).toBe(true);
    expect(timed).toEqual([0]);
  });
});
