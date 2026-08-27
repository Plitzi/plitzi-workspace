import { describe, expect, it, vi } from 'vitest';

import { createRunLogger } from './runLogger';
import { renderLogEvent } from '../../../helpers/serverLog';

import type { ActionRunRecord, ServerLogEvent } from '@plitzi/sdk-shared';

const record = (overrides: Partial<ActionRunRecord> = {}): ActionRunRecord => ({
  runId: 'r1',
  actionId: 'shipping-quote',
  spaceId: 1,
  environment: 'production',
  trigger: 'call',
  status: 'completed',
  durationMs: 12,
  nodes: [
    { id: 'rate', action: 'example.shippingRate', status: 'success' },
    { id: 'answer', action: 'flow.output', status: 'success' }
  ],
  ...overrides
});

const capture = () => {
  const events: ServerLogEvent[] = [];

  return { events, logger: (event: ServerLogEvent) => events.push(event) };
};

describe('createRunLogger', () => {
  it('reports a run as one event on the stream the server already logs through', () => {
    const { events, logger } = capture();

    createRunLogger(logger)(record());

    expect(events[0]).toMatchObject({
      kind: 'run',
      name: 'shipping-quote',
      spaceId: 1,
      trigger: 'call',
      status: 'completed',
      ok: true,
      steps: ['example.shippingRate:success', 'flow.output:success']
    });
  });

  /** The shape of the run, never what it held: a step's result is the customer's data and half of why the output
   *  step exists at all. */
  it('carries no step results and no input', () => {
    const { events, logger } = capture();

    createRunLogger(logger)(record());

    expect(JSON.stringify(events[0])).not.toContain('result');
    expect(JSON.stringify(events[0])).not.toContain('input');
  });

  it('marks anything other than a completed run as not ok', () => {
    const { events, logger } = capture();
    const log = createRunLogger(logger);

    log(record({ status: 'failed', error: 'the provider answered 500' }));
    log(record({ status: 'aborted' }));

    expect(events.map(event => event.ok)).toEqual([false, false]);
    expect(events[0]).toMatchObject({ error: 'the provider answered 500' });
  });

  it('renders as a line, with the steps only on a run that went wrong', () => {
    const { events, logger } = capture();
    const log = createRunLogger(logger);

    log(record());
    log(record({ status: 'failed', error: 'boom', nodes: [{ id: 'rate', action: 'http.request', status: 'failed' }] }));

    expect(renderLogEvent(events[0])).toBe('[Action] shipping-quote via call space=1 completed 12ms ok');
    expect(renderLogEvent(events[1])).toContain('[http.request:failed]');
  });

  /** Best-effort by contract: the runner already refuses to fail a run over its record, and a logger that throws
   *  must not get in through this door instead. */
  it('never lets a sink that throws reach the run', () => {
    const logger = vi.fn(() => {
      throw new Error('the log shipper is down');
    });

    expect(() => createRunLogger(logger)(record())).not.toThrow();
  });
});
