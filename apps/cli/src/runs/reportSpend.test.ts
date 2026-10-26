import { describe, expect, it } from 'vitest';

import { spendText, uiReviewsText } from './reportHead';
import { costliestPieces } from './spent';

const piece = (by: string, task: string, piece: 'task' | 'review', cost: number, turns: number) => ({
  action: 'spent',
  by,
  task,
  piece,
  turns,
  cost
});

// A run's report said tokens alone: its $6.75 — a third of it one designer task — was read off its log by hand.
describe('what a run cost, in its report', () => {
  it('says the cost at the API’s prices, by agent, with the share read again and the costliest pieces', () => {
    const log = [
      piece('dev-1', 't-rooms', 'task', 0.41, 16),
      piece('lead', 't-rooms', 'review', 1.06, 33),
      piece('design-1', 'd-css', 'task', 2.72, 56),
      { action: 'spent', by: 'dev-1', task: 't-dm', piece: 'task', turns: 11 }
    ];
    const costliest = costliestPieces(log, 2);
    expect(costliest.map(each => each.cost)).toEqual([2.72, 1.06]);

    const text = spendText({
      cost: 4.19,
      cachedShare: 96,
      byAgent: [
        { agent: 'dev-1', tokens: 1_000_000, cost: 0.41 },
        { agent: 'design-1', tokens: 4_800_000, cost: 2.72 },
        { agent: 'lead', tokens: 2_000_000, cost: 1.06 }
      ],
      costliest
    });
    expect(text[0]).toBe(
      "- At the API's prices: $4.19 — 7.8M tokens, 96% of them its context read again; design-1 $2.72 · lead $1.06 · dev-1 $0.41"
    );
    expect(text[1]).toBe(
      "- The costliest pieces: design-1 at d-css $2.72 (56 turns) · lead's review of t-rooms $1.06 (33 turns)"
    );
  });

  it('says no cost, the tokens alone, when a model it ran on has no price', () => {
    expect(spendText({ cachedShare: 80, byAgent: [{ agent: 'dev-1', tokens: 500_000 }], costliest: [] })[0]).toMatch(
      /^- No cost: a model it ran on has no price here — 500k tokens/
    );
  });
});

// A run's three UI reviews were all the lead's — its designer at a task of its own — and no line said so.
describe('who reviewed the UI, in a run’s report', () => {
  it('says the lead’s reviews without a designer, and when no designer reviewed any', () => {
    expect(
      uiReviewsText([
        { id: 't-a', design: 'UI by the lead' },
        { id: 't-b', design: 'UI by the lead' },
        { id: 't-c', design: 'no UI' }
      ])[0]
    ).toMatch(/^- UI reviews: 0 by a designer, 2 by the lead without one \(t-a, t-b\) — no designer reviewed any/);
    expect(uiReviewsText([{ id: 't-a', design: 'UI by design-1' }])).toEqual([]);
  });
});
