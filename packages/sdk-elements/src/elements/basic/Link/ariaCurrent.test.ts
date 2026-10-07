import { describe, expect, it } from 'vitest';

import { ariaCurrent } from './ariaCurrent';

describe('ariaCurrent', () => {
  const at = 'https://shop.example.com/carta/?ref=nav#postres';

  it('is the page shown, whatever its query, fragment or trailing slash', () => {
    expect(ariaCurrent('/carta', at, 'page')).toBe('page');
    expect(ariaCurrent('/carta#vinos', at, 'page')).toBe('page');
    expect(ariaCurrent('/', 'https://shop.example.com/', 'page')).toBe('page');
  });

  it('is not another page, a page below it, or a page with no address known', () => {
    expect(ariaCurrent('/vinos', at, 'page')).toBeUndefined();
    expect(ariaCurrent('/', at, 'page')).toBeUndefined();
    expect(ariaCurrent('/carta/postres', at, 'page')).toBeUndefined();
    expect(ariaCurrent('/carta', undefined, 'page')).toBeUndefined();
    expect(ariaCurrent('#top', at, 'page')).toBeUndefined();
  });

  it('is the query it names, among links to one path told apart by it', () => {
    const shown = 'https://quake.example.com/?window=24h&mag=4';

    expect(ariaCurrent('/?window=24h', shown, 'page')).toBe('page');
    expect(ariaCurrent('/?window=6h', shown, 'page')).toBeUndefined();
    expect(ariaCurrent('/?window=24h&mag=5', shown, 'page')).toBeUndefined();
    expect(ariaCurrent('/', shown, 'page')).toBe('page');
    expect(ariaCurrent('/carta?ref=nav', at, 'page')).toBe('page');
  });

  it('marks a section on the pages under it, as the current entry rather than the current page', () => {
    const run = 'https://app.example.com/automations/runs/42';

    expect(ariaCurrent('/automations/runs', run, 'section')).toBe('true');
    expect(ariaCurrent('/automations/runs/', run, 'section')).toBe('true');
    expect(ariaCurrent('/automations', run, 'section')).toBe('true');
    expect(ariaCurrent('/automations/runs', 'https://app.example.com/automations/runs', 'section')).toBe('page');
    expect(ariaCurrent('/automations/runs', run, 'page')).toBeUndefined();
  });

  it('holds a section at a segment boundary, and only for the query it names', () => {
    expect(ariaCurrent('/journal', 'https://ink.example.com/journalism', 'section')).toBeUndefined();
    expect(ariaCurrent('/journal', 'https://ink.example.com/writers/journal', 'section')).toBeUndefined();
    expect(ariaCurrent('/journal?tag=ai', 'https://ink.example.com/journal/a?tag=ai', 'section')).toBe('true');
    expect(ariaCurrent('/journal?tag=ai', 'https://ink.example.com/journal/a?tag=web', 'section')).toBeUndefined();
  });

  it('holds every page under the root, which is what a section of the home is', () => {
    expect(ariaCurrent('/', 'https://shop.example.com/carta', 'section')).toBe('true');
  });
});
