import { describe, expect, it } from 'vitest';

import { fullAnswer, PRINTED_WHOLE } from './watch';

// A run's lead read a 31k `run report --full` three times in four minutes: its harness cut each answer near 30k.
describe('run report --full', () => {
  it('answers whole while it fits one answer, and past that names the file it is written to', () => {
    expect(fullAnswer('the report', 'brief', 'tmp/plitzi-runs/r/report-full.md')).toEqual({
      text: 'the report',
      write: false
    });

    const long = fullAnswer('x'.repeat(PRINTED_WHOLE + 7000), 'brief', 'tmp/plitzi-runs/r/report-full.md');
    expect(long.write).toBe(true);
    expect(long.text).toBe(
      'brief\n\nThe whole report (31k characters, past what one answer shows) is in tmp/plitzi-runs/r/report-full.md — read it in parts.'
    );
  });
});
