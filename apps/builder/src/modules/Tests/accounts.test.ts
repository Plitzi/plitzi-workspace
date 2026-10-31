import { describe, expect, it } from 'vitest';

import { accountFrom, draftOf, namesOf, playedAs, withAccount } from './accounts';

describe('the test accounts, as the Tests area edits them', () => {
  it('reads a form into an account — each list as typed, each name once — or says what to fix', () => {
    expect(namesOf('editor, viewer\nviewer')).toEqual(['editor', 'viewer']);
    expect(
      accountFrom({ id: ' editor ', email: '', roles: 'editor', permissions: 'spaceEdit, spaceView' }, [])
    ).toEqual({
      id: 'editor',
      roles: ['editor'],
      permissions: ['spaceEdit', 'spaceView']
    });
    expect(accountFrom({ id: 'an editor', email: '', roles: '', permissions: '' }, [])).toEqual({
      problem: 'Its id is letters, digits, - and _: editor, visitor-pro'
    });
    expect(accountFrom(draftOf({ id: 'editor' }), ['editor'])).toEqual({
      problem: '"editor" is another test account’s id'
    });
    expect(accountFrom({ id: 'editor', email: '', roles: 'space.editor', permissions: '' }, [])).toEqual({
      problem: '"space.editor" is no role or permission’s name: letters, digits, - and _ (spaceEdit)'
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
