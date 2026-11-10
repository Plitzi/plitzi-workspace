import { describe, expect, it } from 'vitest';

import { AI_CRAWLER_KINDS, AI_CRAWLERS, blockedAiCrawlers } from './aiCrawlers';

describe('the AI crawlers a space keeps out', () => {
  it('lists every kind it has agents for, once', () => {
    expect([...AI_CRAWLER_KINDS].sort()).toEqual(Object.keys(AI_CRAWLERS).sort());
  });

  it('names the agents of the kinds asked for, and none for a setting that is not a list of kinds', () => {
    expect(blockedAiCrawlers(['assistants'])).toEqual([...AI_CRAWLERS.assistants]);
    expect(blockedAiCrawlers(['training', 'nonsense'])).toEqual([...AI_CRAWLERS.training]);
    expect(blockedAiCrawlers(true)).toEqual([]);
    expect(blockedAiCrawlers(undefined)).toEqual([]);
  });
});
