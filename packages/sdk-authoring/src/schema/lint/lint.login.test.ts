import { describe, expect, it } from 'vitest';

import { button, container } from '../../elements';
import { onClick } from '../../elements/steps';
import { authLogin, navigate } from '../../interactions/steps';
import { authorSpace } from '../space';

/** A space with a sign-in page, and the steps its button's flow takes. */
const signIn = (accessLevel: 'public' | undefined, steps: ReturnType<typeof navigate>[]) =>
  authorSpace({
    name: 'Sign in',
    permanentUrl: 'sign-in',
    pages: [
      { name: 'Home', slug: '', isDefault: true, body: [container({ id: 'home-box' })] },
      {
        name: 'Sign in',
        id: 'sign-in',
        slug: 'sign-in',
        ...(accessLevel ? { accessLevel, unauthorizedRedirect: '' } : {}),
        body: [
          button({
            id: 'sign-in-submit',
            label: 'Sign in',
            flows: [[onClick(), authLogin({ username: '{{ state.name }}', password: '{{ state.secret }}' }), ...steps]]
          })
        ]
      }
    ]
  }).warnings.map(warning => warning.code);

// encore-10's sign-in read where to go after the login, from a page the login had already sent the visitor off.
describe('a flow that goes on after the login, on a page for signed-out visitors', () => {
  it('login-then-leaves: is warned, the page leaving as the login succeeds', () => {
    expect(signIn('public', [navigate({ urlType: 'internal', url: '{{ navigation.queryParams.next }}' })])).toContain(
      'login-then-leaves'
    );
  });

  it('is not, ending at the login — nor on a page for everybody, which navigates itself', () => {
    expect(signIn('public', [])).not.toContain('login-then-leaves');
    expect(signIn(undefined, [navigate({ urlType: 'internal', url: '/' })])).not.toContain('login-then-leaves');
  });
});
