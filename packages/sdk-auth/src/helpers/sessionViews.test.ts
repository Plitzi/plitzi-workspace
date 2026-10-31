import { describe, expect, it, vi } from 'vitest';

import { guestAuth, testAccountAuth } from './sessionViews';

import type { AuthContextValue } from '@plitzi/sdk-shared';

/** An editor's session, as the canvas has one: what the page would read of it. */
const editor = {
  authenticated: true,
  state: 'authenticated',
  provider: 'plitzi',
  can: () => true,
  logout: () => Promise.resolve(),
  user: {
    accessToken: 'editor',
    details: { id: 1, username: 'admin', email: 'a@b.c', verified: true, permissions: ['x'], roles: [] }
  }
} as unknown as AuthContextValue; // Its other methods are not called here.

describe('the page’s session while a journey plays', () => {
  it('is none of the editor’s for a guest', () => {
    const guest = guestAuth(editor);

    expect([guest.authenticated, guest.state, guest.user, guest.can('x'), guest.provider]).toEqual([
      false,
      'guest',
      undefined,
      false,
      'plitzi'
    ]);
  });

  it('is the test account’s, with its permissions and a token no server takes — and signing out drops it', async () => {
    const signOut = vi.fn();
    const editorOfSpace = testAccountAuth(
      editor,
      { id: 'editor-of-space', email: 'e@test.invalid', roles: ['editor'], permissions: ['spaceEdit'] },
      signOut
    );

    expect(editorOfSpace.user).toEqual({
      accessToken: 'test:editor-of-space',
      details: {
        id: 0,
        username: 'editor-of-space',
        email: 'e@test.invalid',
        verified: true,
        permissions: ['spaceEdit'],
        roles: ['editor']
      }
    });
    expect([editorOfSpace.can('spaceEdit'), editorOfSpace.can('adminManage')]).toEqual([true, false]);
    await editorOfSpace.logout();
    expect(signOut).toHaveBeenCalledOnce();
  });
});
