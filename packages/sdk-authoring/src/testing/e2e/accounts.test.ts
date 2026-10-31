import { afterEach, describe, expect, it, vi } from 'vitest';

import { e2e, e2eTestProblems, runE2eTest } from './index';
import { text } from '../../elements';
import { authorSpace } from '../../schema';
import { readSpaceTests } from '../tests';

import type { E2ePage } from './page';

const { schema } = authorSpace({
  name: 'Console',
  permanentUrl: 'console',
  pages: [
    { name: 'Sign in', slug: '', body: [text('Sign in', { id: 'sign-in' })] },
    { name: 'Account', slug: 'account', accessLevel: 'authenticated', body: [text('Yours', { id: 'yours' })] }
  ]
});

const editor = e2e.account({
  id: 'editor',
  email: 'editor@test.invalid',
  roles: ['editor'],
  permissions: ['spaceEdit']
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a journey played as a test account', () => {
  it('names an account the tests declare, each declared once and named as roles are', () => {
    const asEditor = e2e.test({
      id: 'as-editor',
      title: 'The account, as an editor',
      page: '/account',
      as: 'editor',
      steps: [e2e.expectShown('yours')]
    });

    expect(e2eTestProblems(schema, [asEditor], [], [editor])).toEqual([]);
    expect(e2eTestProblems(schema, [{ ...asEditor, as: 'owner' }], [], [editor])).toEqual([
      'e2e test "as-editor": it plays as "owner", which is none of the test accounts — declare it in tests.accounts, or play it as a guest'
    ]);
    expect(e2eTestProblems(schema, [], [], [editor, { id: 'editor', roles: ['space editor'] }])).toEqual([
      'test account "editor": its id is another test account\'s — each has its own',
      'test account "editor": "space editor" is no role or permission\'s name — letters, digits, - and _ (spaceEdit)'
    ]);
  });

  it('are read with the tests from outside — every way one is not said', () => {
    expect(readSpaceTests({ accounts: [editor] })).toEqual({ tests: { unit: [], e2e: [], accounts: [editor] } });
    expect(readSpaceTests({ accounts: [{ roles: 'editor' }] })).toEqual({
      problems: ['tests.accounts[0].id: words', 'tests.accounts[0].roles: a list of role names']
    });
  });

  // A page for signed-in visitors sends a guest to sign in on its first load: signed in, the page is moved back to it.
  it('is signed in as it before its first step, and moved to the page it starts on', async () => {
    const calls: [string, unknown][] = [];
    // The dev tools' bridge, as the page's window holds it.
    vi.stubGlobal('window', {
      location: { pathname: '/', search: '' },
      __plitzi: {
        signInAs: (account: unknown) => calls.push(['signInAs', account]) && 'Signed in',
        navigate: (path: unknown) => calls.push(['navigate', path]) && path
      }
    });
    // The fake answers what a run asks of a page with no steps: its size, its scheme, the bridge — and settling, at once.
    const page = {
      setViewportSize: () => Promise.resolve(),
      emulateMedia: () => Promise.resolve(),
      waitForSelector: () => Promise.resolve({}),
      evaluate: <R, A>(fn: (arg: A) => R, arg: A) =>
        Promise.resolve(typeof arg === 'object' && arg !== null && 'most' in arg ? undefined : fn(arg))
    } as unknown as E2ePage;

    const played = await runE2eTest(
      page,
      e2e.test({ id: 'as-editor', title: 'The account', page: '/account', as: 'editor', steps: [] }),
      { origin: 'http://127.0.0.1', open: () => Promise.resolve(), space: { ...schema, tests: { accounts: [editor] } } }
    );

    expect(played.problem).toBeUndefined();
    expect(calls).toEqual([
      ['signInAs', editor],
      ['navigate', '/account']
    ]);
  });

  it('says so when the space declares no such account', async () => {
    const page = {
      setViewportSize: () => Promise.resolve(),
      emulateMedia: () => Promise.resolve(),
      waitForSelector: () => Promise.resolve({})
    } as unknown as E2ePage;

    const played = await runE2eTest(
      page,
      e2e.test({ id: 'as-owner', title: 'The account', page: '/account', as: 'owner', steps: [] }),
      { origin: 'http://127.0.0.1', open: () => Promise.resolve(), space: schema }
    );

    expect(played.problem).toContain('it plays as "owner", which is none of the space\'s test accounts');
  });
});
