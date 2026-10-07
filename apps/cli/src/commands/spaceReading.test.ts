import { describe, expect, it } from 'vitest';

import { childrenChange, isReadings, reachedToo, spaceEffects, surprises } from './spaceReading';

import type { ElementReading } from './spaceReading';

const reading = (elementId: string, attributes: Record<string, unknown>, classes: string[] = []): ElementReading => ({
  elementId,
  type: 'text',
  rootId: 'home',
  classes,
  attributes,
  templates: [],
  bound: [],
  children: []
});

const before = [reading('title', { content: 'Hi', level: 1 }), reading('footer-title', { content: 'Hi' })];

describe('what an edit did to the space', () => {
  it('says every attribute changed, and anything else about an element', () => {
    const after = [reading('title', { content: 'Hello' }, ['big']), reading('footer-title', { content: 'Hi' })];

    expect(spaceEffects(before, after).map(effect => effect.line)).toEqual([
      'title classes: [] → ["big"]',
      'title.content: "Hi" → "Hello"',
      'title.level removed (was 1)'
    ]);
  });

  it('says an element added or gone', () => {
    expect(spaceEffects(before, [before[0], reading('cta', {})]).map(effect => effect.line)).toEqual([
      'footer-title (text) removed',
      'cta (text) added'
    ]);
  });

  it('reads the same values in another order as no change', () => {
    expect(spaceEffects([reading('a', { x: { b: 1, a: 2 } })], [reading('a', { x: { a: 2, b: 1 } })])).toEqual([]);
  });
});

// A constant or a helper shared by two elements: the edit asked for one, and the other changed too. Never kept silently.
describe('what an edit did that was not asked, or did not do', () => {
  const asked = new Map([['title', [{ key: 'content', value: 'Hello' }]]]);

  it('is nothing when the space changed exactly as asked', () => {
    const after = [reading('title', { content: 'Hello', level: 1 }), reading('footer-title', { content: 'Hi' })];

    expect(surprises(spaceEffects(before, after), after, asked)).toEqual([]);
  });

  it('names every other change, and every asked one that is not there', () => {
    const after = [reading('title', { content: 'Hi', level: 1 }), reading('footer-title', { content: 'Hello' })];

    expect(surprises(spaceEffects(before, after), after, asked)).toEqual([
      'title.content reads "Hi", not "Hello"',
      'it changed footer-title.content: "Hi" → "Hello" too, which was not asked'
    ]);
  });
});

// A nav and a menu drawn from one list entry: the label asked of one is the other's too, and is said as such.
describe('what an edit reached with the very value asked', () => {
  it('names the elements given the same attribute and value, and nothing else', () => {
    const asked = new Map([['title', [{ key: 'content', value: 'Hello' }]]]);
    const after = [reading('title', { content: 'Hello', level: 2 }), reading('footer-title', { content: 'Hello' })];

    expect(reachedToo(spaceEffects(before, after), after, asked, [{ key: 'content', value: 'Hello' }])).toEqual([
      { elementId: 'footer-title', change: { key: 'content', value: 'Hello' } }
    ]);
  });
});

describe('how an element’s children changed', () => {
  it('says what came and went, the one that moved and where it is now', () => {
    expect(childrenChange(['hero', 'pricing', 'faq', 'closing'], ['hero', 'pricing', 'faq'])).toBe('−closing');
    expect(childrenChange(['hero', 'pricing', 'faq'], ['hero', 'faq', 'pricing'])).toBe(
      'faq moved — now after hero, before pricing'
    );
    expect(childrenChange(['a', 'b', 'c'], ['c', 'b', 'a'])).toBe('reordered: c, b, a');
  });
});

describe('the space as another process printed it', () => {
  it('is read only when every entry is an element’s reading', () => {
    expect(isReadings(before)).toBe(true);
    expect(isReadings([{ elementId: 'a' }])).toBe(false);
    expect(isReadings({ problem: 'no' })).toBe(false);
  });
});
