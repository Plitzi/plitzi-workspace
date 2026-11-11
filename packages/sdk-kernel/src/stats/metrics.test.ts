import { describe, expect, it, vi } from 'vitest';

import { gaugesText, metricsText } from './metrics';
import { createStatsRecorder } from './recorder';
import { deploymentGauges } from './stage';
import { serverLog } from '../log/serverLog';

const MINUTE = 60_000;

describe('metrics, as Prometheus reads them', () => {
  it('says a process’s work by window, its load and its health, labelled by its pool and its process', () => {
    const now = 100 * MINUTE;
    const recorder = createStatsRecorder({ pool: 'worker', instance: 'w-1' }, () => now);
    recorder.run(40);
    recorder.run(30, { failed: 'error' });
    recorder.run(50, { limit: 'cpu' });
    recorder.refuse('over_capacity');
    const text = metricsText(recorder.snapshot());

    expect(text).toContain('# TYPE plitzi_process_runs gauge');
    expect(text).toContain('plitzi_process_runs{pool="worker",process="w-1",window="15m"} 3');
    expect(text).toContain('plitzi_process_run_failures{pool="worker",process="w-1",window="15m",reason="error"} 1');
    expect(text).toContain('plitzi_process_run_limits{pool="worker",process="w-1",window="1m",limit="cpu"} 1');
    expect(text).toContain(
      'plitzi_process_refusals{pool="worker",process="w-1",window="60m",reason="over_capacity"} 1'
    );
    expect(text).toMatch(/^plitzi_process_health\{pool="worker",process="w-1",status="healthy"\} 1$/m);
    expect(text).toMatch(/^plitzi_process_health\{pool="worker",process="w-1",status="stopping"\} 0$/m);
    expect(text.match(/^# HELP plitzi_process_runs /gm)).toHaveLength(1);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('escapes what a label holds, and refuses a name a scraper would refuse, naming it', () => {
    expect(gaugesText([{ name: 'queue_waiting', help: 'Waiting', value: 2, labels: { kind: 'a "b"\\c' } }])).toContain(
      'queue_waiting{kind="a \\"b\\"\\\\c"} 2'
    );
    expect(() => gaugesText([{ name: 'queue-waiting', help: 'Waiting', value: 2 }])).toThrow(
      /"queue-waiting" is no metric name/
    );
    expect(() => gaugesText([{ name: 'queue_waiting', help: 'Waiting', value: 2, labels: { 'a-b': 'x' } }])).toThrow(
      /the label "a-b"/
    );
  });

  it('keeps the process’s figures when the deployment’s cannot be read, and says so', async () => {
    const error = vi.spyOn(serverLog, 'error').mockImplementation(() => undefined);
    const rejected = await deploymentGauges({
      secret: 's',
      pool: 'pages',
      gauges: () => Promise.reject(new Error('db gone'))
    });
    const malformed = await deploymentGauges({
      secret: 's',
      pool: 'pages',
      gauges: () => Promise.resolve([{ name: 'bad name', help: 'x', value: 1 }])
    });

    expect(rejected).toEqual([expect.objectContaining({ name: 'plitzi_stats_gauges_failed', value: 1 })]);
    expect(malformed).toEqual([expect.objectContaining({ name: 'plitzi_stats_gauges_failed', value: 1 })]);
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});
