import { describe, expect, it } from 'vitest';

import { configureServerLog, serverLog } from './serverLog';
import { LOG_TAIL_SIZE, keepLogLine, logQueryOf, readLogTail } from './tail';

describe('a process’s log tail', () => {
  it('keeps what the console leaves out, and answers what came after a line, at a level, by a word', () => {
    configureServerLog({ level: 'error' });
    const { last: before } = readLogTail();
    serverLog.debug('Jobs', 'claimed 0 jobs');
    serverLog.warn('Jobs', 'a lease lapsed');
    keepLogLine('info', '[Runtimes] space 20 (main) runtime on 127.0.0.1:8800');

    const all = readLogTail({ since: before });
    const warnings = readLogTail({ since: before, level: 'warn' });
    const found = readLogTail({ since: before, q: 'RUNTIME' });
    const after = readLogTail({ since: all.last });

    expect(all.lines.map(line => [line.level, line.kind])).toEqual([
      ['debug', 'message'],
      ['warn', 'message'],
      ['info', 'app']
    ]);
    expect(warnings.lines.map(line => line.text)).toEqual(['[Jobs] a lease lapsed']);
    expect(found.lines).toHaveLength(1);
    expect(after.lines).toEqual([]);
    configureServerLog({ level: 'info' });
  });

  it('keeps only the last lines, and reads a query string without trusting it', () => {
    for (let line = 0; line < LOG_TAIL_SIZE + 5; line += 1) {
      keepLogLine('info', `line ${String(line)}`);
    }

    expect(readLogTail().kept).toBe(LOG_TAIL_SIZE);
    expect(readLogTail({ limit: 2 }).lines.map(line => line.text)).toEqual([
      `line ${String(LOG_TAIL_SIZE + 3)}`,
      `line ${String(LOG_TAIL_SIZE + 4)}`
    ]);
    expect(logQueryOf({ since: '12', level: 'warn', limit: 'x', q: 'jobs' })).toEqual({
      since: 12,
      level: 'warn',
      q: 'jobs'
    });
    expect(logQueryOf({ since: '-3', level: 'loud' })).toEqual({});
  });

  it('refuses a slow-run threshold that is no duration', () => {
    expect(() => configureServerLog({ level: 'info', slowRunMs: 0 })).toThrow('slowRunMs is a number');
  });
});
