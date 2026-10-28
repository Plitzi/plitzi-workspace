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
