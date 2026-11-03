import { describe, expect, it } from 'vitest';

import { runMiddlewares } from './runMiddlewares';

import type { SSRMiddleware, SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-shared';

const request = () => ({ ctx: {} }) as unknown as SSRRequest;
const response = {} as SSRResponseHelpers;

const waits =
  (ms: number): SSRMiddleware =>
  async (_req, _res, next) => {
    await new Promise(resolve => setTimeout(resolve, ms));
    await next();
  };

describe('runMiddlewares', () => {
  // The chain's own time per middleware: what each one waited for before it handed on, not the ones after it.
  it('times each middleware until it hands on, not the chain after it', async () => {
    const timed: [number, number][] = [];
    await runMiddlewares([waits(30), waits(5)], request(), response, (index, ms) => timed.push([index, ms]));

    expect(timed.map(([index]) => index)).toEqual([0, 1]);
    expect(timed[0][1]).toBeGreaterThanOrEqual(25);
    expect(timed[0][1]).toBeLessThan(60);
    expect(timed[1][1]).toBeLessThan(25);
  });

  it('times a middleware that ends the chain until it ends it', async () => {
    const timed: number[] = [];
    const stopped = await runMiddlewares([() => undefined, waits(5)], request(), response, index => timed.push(index));

    expect(stopped).toBe(true);
    expect(timed).toEqual([0]);
  });
});
