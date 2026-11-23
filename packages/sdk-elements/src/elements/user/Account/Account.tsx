import clsx from 'clsx';
import { use, useCallback, useRef, useState } from 'react';

import { AuthContext } from '@plitzi/sdk-auth';
import { usePlitzi } from '@plitzi/sdk-shared/hooks';
import { useCommonStore, useSdkStore } from '@plitzi/sdk-shared/store';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';
import useDetails from '../../structure/Disclosure/useDetails';
import AvatarFace, { avatarHue } from '../Avatar/AvatarFace';

import type { AuthContextValue } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject } from 'react';

export type AccountProps = {
  ref?: RefObject<HTMLElement | null>;
  className?: string;
  /** What its menu offers besides signing out — the visitor's profile, their settings: links or buttons. */
  children?: ReactNode;
  /**
   * Where a guest signs in: the space's sign-in page — `/sign-in` — sent with `?redirect=` back to the page they were
   * on. Empty, the provider's own: on Plitzi, out to "Sign in with Plitzi" and back.
   */
  signInHref?: string;
  signInLabel?: string;
  signOutLabel?: string;
  /** Where a visitor goes after signing out. Empty, they stay, and the page shows itself to a guest. */
  signOutHref?: string;
};

/** Who the builder shows the menu for while it is edited: nobody is signed in there. */
const EDITED_AS = { username: 'Your name', email: 'you@example.com' };

/** The page a guest is on, to come back to: its path and query, never another site's. */
const hereOf = (href: string | undefined): string => {
  try {
    const url = new URL(href ?? '', 'https://page.invalid');

    return `${url.pathname}${url.search}`;
  } catch {
    return '/';
  }
};

/** A sign-in page's address with the way back on it, after whatever query it already has. */
const withRedirect = (signInHref: string, here: string): string =>
  `${signInHref}${signInHref.includes('?') ? '&' : '?'}redirect=${encodeURIComponent(here)}`;

/**
 * Who is signed in, where a page says it: a guest gets a way to sign in; somebody signed in, their face — a menu with
 * their name and address, what the space offers them, and signing out. Nothing while the session is still being found
 * out, so neither flashes before the other.
 */
const Account = ({
  ref,
  className = '',
  children,
  signInHref = '',
  signInLabel = 'Sign in',
  signOutLabel = 'Sign out',
  signOutHref = ''
}: AccountProps) => {
  const {
    definition: { styleSelectors }
  } = useElement();
  const {
    settings: { previewMode }
  } = usePlitzi();
  const auth: Partial<AuthContextValue> = use(AuthContext);
  const [href] = useCommonStore('navigation.href');
  const [navigate] = useSdkStore('navigation.navigate');
  const menuRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  // Edited in the builder, the menu is shown open, as somebody signed in sees it, for its entries to be edited.
  const editing = !previewMode;
  const details = useDetails({
    ref: menuRef,
    open,
    setOpen,
    editing,
    closeOnClickOutside: true,
    closeOnNavigate: true
  });

  const signIn = useCallback(async () => {
    const result = await auth.login?.({});
    if (result && !result.ok && result.reason !== 'mfa') {
      console.warn(
        `[plitzi] account: signing in here needs a form (${auth.provider || 'no provider'}): give it a signInHref, the space's sign-in page.`
      );
    }
  }, [auth]);

  const signOut = useCallback(async () => {
    setOpen(false);
    await auth.logout?.();
    if (signOutHref) {
      navigate(signOutHref);
    }
  }, [auth, navigate, signOutHref]);

  const signedIn = editing ? EDITED_AS : auth.authenticated ? auth.user?.details : undefined;
  const settled = editing || auth.state === 'authenticated' || auth.state === 'guest';

  let shown: ReactNode = null;
  if (signedIn) {
    const name = signedIn.username || signedIn.email;
    shown = (
      <details
        ref={element => {
          menuRef.current = element;
        }}
        className="plitzi-component__account-menu"
        open={editing || open}
        {...details}
      >
        <summary className={clsx('plitzi-component__account-trigger', styleSelectors.trigger)}>
          <span className="plitzi-component__avatar" style={avatarHue(name)} aria-hidden="true">
            <AvatarFace name={name} />
          </span>
          <span className="plitzi-component__account-name">{name}</span>
        </summary>
        <div className={clsx('plitzi-component__account-panel', styleSelectors.panel)}>
          <div className={clsx('plitzi-component__account-who', styleSelectors.identity)}>
            <span className="plitzi-component__account-who-name">{name}</span>
            {signedIn.email && signedIn.email !== name && (
              <span className="plitzi-component__account-who-email">{signedIn.email}</span>
            )}
          </div>
          {children}
          <button
            type="button"
            className={clsx('plitzi-component__account-sign-out', styleSelectors.signOut)}
            onClick={() => void signOut()}
          >
            {signOutLabel}
          </button>
        </div>
      </details>
    );
  } else if (settled) {
    const signInClass = clsx('plitzi-component__account-sign-in', styleSelectors.signIn);
    shown = signInHref ? (
      <a className={signInClass} href={withRedirect(signInHref, hereOf(href))}>
        {signInLabel}
      </a>
    ) : (
      <button type="button" className={signInClass} onClick={() => void signIn()}>
        {signInLabel}
      </button>
    );
  }

  return (
    <RootElement
      ref={ref}
      className={clsx('plitzi-component__account', className)}
      aria-busy={settled ? undefined : true}
    >
      {shown}
    </RootElement>
  );
};

export default withElement(Account);

export { Account };
