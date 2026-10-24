import { describe, expect, it } from 'vitest';

import { briefsOf, briefsText } from './briefs';

// encore-2: 61 briefs read again for 1.1M tokens, and nothing said which part of them weighed.
describe('the briefs a run read', () => {
  it('are summed by part, with their median and each part’s share — none without one', () => {
    const log = [
      { action: 'brief', task: 't-a', parts: { primer: 3000, brief: 1000, imports: 0 } },
      { action: 'brief', task: 't-b', parts: { primer: 3000, brief: 2000, imports: 1000 } },
      { action: 'take', task: 't-a' }
    ];
    const briefs = briefsOf(log);

    expect(briefs).toEqual({ calls: 2, median: 6000, byPart: { primer: 6000, brief: 3000, imports: 1000 } });
    expect(briefsText(briefs)).toEqual([
      '- Briefs (task context): 2, the median 6000 characters — primer 60%, brief 30%, imports 10%'
    ]);
    expect(briefsOf([{ action: 'take' }])).toBeUndefined();
  });
});
