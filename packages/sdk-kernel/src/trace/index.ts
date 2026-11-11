import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';

/**
 * One trace for a run, across every process it crosses: the W3C Trace Context `traceparent` taken at the edge — or
 * made there — and carried on every hop (the page server to the worker, the worker to the runner, a runtime). Each
 * process answers a request as a span of its own in the caller's trace, and every line it logs meanwhile names the
 * trace (`trace=…`), so the lines of one run are found together whichever instance said them. No vendor and no exporter:
 * a deployment that wants spans in a collector reads them off the log events, or wraps the hops itself.
 */

export const TRACEPARENT = 'traceparent';

export type Trace = {
  /** 32 hexadecimal characters: the same on every hop of one run. */
  traceId: string;
  /** 16 hexadecimal characters: this process's span. */
  spanId: string;
  /** The trace flags the caller sent (`01`, sampled), kept as they came. */
  flags: string;
};

const TRACEPARENT_FORMAT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const NONE = /^0+$/;

const hex = (bytes: number): string => randomBytes(bytes).toString('hex');

/** A caller's trace, from its `traceparent` — nothing from a header that is not one (an id of zeros is none, as W3C says). */
export const readTraceparent = (header: string | readonly string[] | undefined): Trace | undefined => {
  const value = typeof header === 'string' ? header : header?.[0];
  const match = typeof value === 'string' ? TRACEPARENT_FORMAT.exec(value.trim().toLowerCase()) : null;
  if (!match || NONE.test(match[1]) || NONE.test(match[2])) {
    return undefined;
  }

  return { traceId: match[1], spanId: match[2], flags: match[3] };
};

/** A span of this process: in the caller's trace when there is one, the first of a new trace when there is none. */
export const spanOf = (parent?: Trace): Trace => ({
  traceId: parent?.traceId ?? hex(16),
  spanId: hex(8),
  flags: parent?.flags ?? '01'
});

export const traceparentOf = (trace: Trace): string => `00-${trace.traceId}-${trace.spanId}-${trace.flags}`;

const storage = new AsyncLocalStorage<Trace>();

/** Runs work as a span of a trace: everything it awaits, and every line it logs, is that trace's. */
export const runInTrace = <T>(trace: Trace, work: () => T): T => storage.run(trace, work);

/** The trace the work in hand is part of, when it is part of one. */
export const currentTrace = (): Trace | undefined => storage.getStore();

/** The header a hop carries: the trace in hand as the caller of the next span. Empty outside a trace. */
export const traceHeaders = (): Record<string, string> => {
  const trace = currentTrace();

  return trace ? { [TRACEPARENT]: traceparentOf(trace) } : {};
};
