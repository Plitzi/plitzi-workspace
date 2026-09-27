import { describe, expect, it } from 'vitest';

import { parseProbeOutput, PROBE_PREFIX } from './protocol';

const sample = { t: 1, rss: 2, heapUsed: 3, heapTotal: 4, external: 5, arrayBuffers: 6, codeSpace: 7 };

describe('parseProbeOutput', () => {
  it('picks the probe lines out of whatever else the server printed, docker timestamps included', () => {
    const output = [
      'listening on 4300',
      `${PROBE_PREFIX}${JSON.stringify(sample)}`,
      `2026-09-24T14:00:00.000Z ${PROBE_PREFIX}${JSON.stringify({ ...sample, t: 2 })}`,
      '[SSR] Unhandled error'
    ].join('\n');

    expect(parseProbeOutput(output).map(entry => entry.t)).toEqual([1, 2]);
  });

  it('skips a line cut short or missing a figure rather than reporting zeros', () => {
    const { codeSpace: _dropped, ...partial } = sample;
    const output = [`${PROBE_PREFIX}{"t":1,"rss"`, `${PROBE_PREFIX}${JSON.stringify(partial)}`].join('\n');

    expect(parseProbeOutput(output)).toEqual([]);
  });
});
