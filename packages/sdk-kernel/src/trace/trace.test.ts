import { describe, expect, it } from 'vitest';

import { currentTrace, readTraceparent, runInTrace, spanOf, traceHeaders, traceparentOf } from './index';

const CALLER = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

describe('a trace across processes', () => {
  it('reads a caller’s traceparent, and nothing from what is not one', () => {
    expect(readTraceparent(CALLER)).toEqual({
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      flags: '01'
    });
    expect(readTraceparent([CALLER])).toMatchObject({ traceId: '4bf92f3577b34da6a3ce929d0e0e4736' });
    expect(readTraceparent(undefined)).toBeUndefined();
    expect(readTraceparent('00-xyz-1-01')).toBeUndefined();
    // An id of zeros is no trace, as W3C says.
    expect(readTraceparent('00-00000000000000000000000000000000-00f067aa0ba902b7-01')).toBeUndefined();
  });

  it('answers as a span of the caller’s trace, or the first of a new one', () => {
    const caller = readTraceparent(CALLER);
    const ours = spanOf(caller);

    expect(ours.traceId).toBe(caller?.traceId);
    expect(ours.spanId).not.toBe(caller?.spanId);
    expect(traceparentOf(ours)).toMatch(/^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/);
    expect(spanOf().traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is the trace of everything the work awaits, and the header every hop of it carries', async () => {
    const trace = spanOf(readTraceparent(CALLER));

    expect(currentTrace()).toBeUndefined();
    expect(traceHeaders()).toEqual({});
    await runInTrace(trace, async () => {
      await new Promise(resolve => setTimeout(resolve, 1));

      expect(currentTrace()).toBe(trace);
      expect(traceHeaders()).toEqual({ traceparent: traceparentOf(trace) });
    });
    expect(currentTrace()).toBeUndefined();
  });
});
