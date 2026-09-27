import { describe, expect, it } from 'vitest';

import { parseCpuTime, sumProcessTree } from './local';

describe('local runtime', () => {
  it('reads every shape of ps CPU time', () => {
    expect(parseCpuTime('0:01.50')).toBe(1_500_000);
    expect(parseCpuTime('01:02:03')).toBe(3_723_000_000);
    expect(parseCpuTime('1-00:00:00')).toBe(86_400_000_000);
  });

  it('adds the children a server started to it, and nothing else', () => {
    const rows = [
      { pid: 10, ppid: 1, rssKb: 100, cpuUsec: 1000 },
      { pid: 11, ppid: 10, rssKb: 20, cpuUsec: 200 },
      { pid: 12, ppid: 11, rssKb: 5, cpuUsec: 50 },
      { pid: 20, ppid: 1, rssKb: 999, cpuUsec: 9999 }
    ];

    expect(sumProcessTree(rows, 10)).toEqual({ rssKb: 125, cpuUsec: 1250 });
  });
});
