import { describe, expect, it } from 'vitest';

import { notOnPageText } from './notOnPage';

/** A page that holds none of what is asked. */
const empty = { locator: () => ({ first: () => ({ count: () => Promise.resolve(0) }) }) };

// A tester dismissed a report and was told of its key "its name, a tag or a selector": the name was right, the row gone.
describe('what is said of a name not on the page', () => {
  it('says how the command reaches a part a press makes, and that a list emptied by a press holds no row', async () => {
    const said = await notOnPageText(empty, 'moderation-dismiss', 'a step before it');

    expect(said).toContain('a visitor’s steps make (a step before it)');
    expect(said).toContain('a row of a list that is empty now');
  });
});

// A developer read "not on the page" of `room-crate-add:2` as no `:N` at all: the page drew one copy at that width.
describe('a row asked past the copies drawn', () => {
  it('says how many copies of the name there are, and how to name a row by its list', async () => {
    // One copy drawn: the first is found, the second — by name, or by its place — is not.
    const one = {
      locator: (selector: string) => ({
        first: () => ({ count: () => Promise.resolve(/nth=(?!0$)/.test(selector) ? 0 : 1) })
      })
    };

    expect(await notOnPageText(one, 'room-crate-add:2', 'a step before it')).toBe(
      'room-crate-add is drawn 1 time here — :2 counts every copy on the page, hidden ones too, and a part drawn once a width is two copies: a row by its list is `[data-plitzi-el=<list>] > li:nth-of-type(2) …`'
    );
  });
});
