import { describe, expect, it } from 'vitest';

import { accountFrom, draftOf, playedAs, withAccount } from './accounts';

describe('the test accounts, as the Tests area edits them', () => {
  it('reads a form into an account — its roles as chosen — or says what to fix', () => {
    expect(accountFrom({ id: ' editor ', email: '', roles: ['editor'] }, [])).toEqual({
      id: 'editor',
      roles: ['editor']
    });
    expect(accountFrom({ id: 'an editor', email: '', roles: [] }, [])).toEqual({
      problem: 'Its id is letters, digits, - and _: editor, visitor-pro'
    });
    expect(accountFrom(draftOf({ id: 'editor' }), ['editor'])).toEqual({
      problem: '"editor" is another test account’s id'
    });
  });

  it('keeps an account in its place when edited, and says which journeys play as one', () => {
    const accounts = [{ id: 'editor' }, { id: 'viewer' }];

    expect(withAccount(accounts, { id: 'editor', roles: ['editor'] })).toEqual([
      { id: 'editor', roles: ['editor'] },
      { id: 'viewer' }
    ]);
    expect(withAccount(accounts, { id: 'owner' })).toHaveLength(3);
    expect(
      playedAs(
        [
          { id: 'a', title: 'Edits a page', page: '/', as: 'editor', steps: [] },
          { id: 'b', title: '', page: '/', steps: [] }
        ],
        'editor'
      )
    ).toEqual(['Edits a page']);
  });
});
