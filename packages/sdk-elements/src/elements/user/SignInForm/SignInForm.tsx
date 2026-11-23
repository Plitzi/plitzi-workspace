import clsx from 'clsx';
import { use, useCallback, useId, useMemo, useState } from 'react';

import { AuthContext } from '@plitzi/sdk-auth';
import { usePlitzi } from '@plitzi/sdk-shared/hooks';
import { useCommonStore, useSdkStore } from '@plitzi/sdk-shared/store';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { AuthContextValue, AuthFailureReason } from '@plitzi/sdk-shared';
import type { FormEvent, RefObject } from 'react';

export type SignInFormProps = {
  ref?: RefObject<HTMLElement | null>;
  className?: string;
  usernameLabel?: string;
  passwordLabel?: string;
  /** The second factor's field, asked for once the password was right and the account has one. */
  codeLabel?: string;
  submitLabel?: string;
  /**
   * Where a visitor goes once in. Empty, back to the `?redirect=` they were sent with — a page of this site — or
   * nowhere: the page shows itself to them with their session.
   */
  redirectTo?: string;
  /** Said when the address or the password is not right. */
  wrongMessage?: string;
  /** Said when the password was right and the address has never been confirmed. */
  unverifiedMessage?: string;
  /** Said when the account is blocked or was closed. */
  blockedMessage?: string;
  /** Said when the account's organization signs it in through its own single sign-on. */
  ssoMessage?: string;
  /** Said when the sign-in could not be reached at all. */
  networkMessage?: string;
};

type Messages = Required<
  Pick<SignInFormProps, 'wrongMessage' | 'unverifiedMessage' | 'blockedMessage' | 'ssoMessage' | 'networkMessage'>
>;

/** What a refusal says to the visitor: the one thing they can do about each, never one sentence for all of them. */
const messageOf = (reason: AuthFailureReason, messages: Messages): string => {
  switch (reason) {
    case 'unverified':
      return messages.unverifiedMessage;
    case 'inactive':
    case 'revoked':
      return messages.blockedMessage;
    case 'sso-required':
      return messages.ssoMessage;
    case 'network':
      return messages.networkMessage;
    default:
      return messages.wrongMessage;
  }
};

/** A `?redirect=` worth following: a path of this site, never another's (`//evil.test` is one). */
const sameSite = (value: unknown): string | undefined =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : undefined;

const textOf = (data: FormData, name: string): string => {
  const value = data.get(name);

  return typeof value === 'string' ? value : '';
};

/**
 * The space's sign-in. Through Plitzi — or any provider that signs in by going out and back — one button; against the
 * space's own sign-in (`basic`), its address and password, then the code of a second factor when the account has one.
 * Every refusal is said for what it is, and a visitor signed in goes back to where they were sent from.
 */
const SignInForm = ({
  ref,
  className = '',
  usernameLabel = 'Email',
  passwordLabel = 'Password',
  codeLabel = 'Code',
  submitLabel = 'Sign in',
  redirectTo = '',
  wrongMessage = 'That email or password is not right.',
  unverifiedMessage = 'Confirm your email first: the link is in your inbox.',
  blockedMessage = 'This account cannot sign in.',
  ssoMessage = 'Your organization signs you in with its own single sign-on.',
  networkMessage = 'Signing in could not be reached. Try again in a moment.'
}: SignInFormProps) => {
  const {
    definition: { styleSelectors }
  } = useElement();
  const {
    settings: { previewMode }
  } = usePlitzi();
  const auth: Partial<AuthContextValue> = use(AuthContext);
  const [redirect] = useCommonStore('navigation.queryParams.redirect');
  const [navigate] = useSdkStore('navigation.navigate');
  const id = useId();
  const [mfaToken, setMfaToken] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const editing = !previewMode;
  const messages = useMemo(
    () => ({ wrongMessage, unverifiedMessage, blockedMessage, ssoMessage, networkMessage }),
    [wrongMessage, unverifiedMessage, blockedMessage, ssoMessage, networkMessage]
  );
  const outAndBack = !editing && auth.provider === 'server';
  const unset = !editing && !auth.provider;

  const signedIn = useCallback(() => {
    const target = redirectTo || sameSite(redirect);
    if (target) {
      navigate(target);
    }
  }, [navigate, redirect, redirectTo]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (editing || busy || !auth.login) {
        return;
      }

      const data = new FormData(event.currentTarget);
      setBusy(true);
      setProblem('');
      const result = await auth.login(
        mfaToken
          ? { mode: 'mfa', mfaToken, code: textOf(data, 'code') }
          : { username: textOf(data, 'username'), password: textOf(data, 'password') }
      );
      setBusy(false);
      if (result.ok) {
        signedIn();

        return;
      }

      if (result.reason === 'mfa') {
        setMfaToken(result.mfaToken);

        return;
      }

      setProblem(messageOf(result.reason, messages));
    },
    [editing, busy, auth, mfaToken, signedIn, messages]
  );

  const field = (name: string, label: string, input: Record<string, string>) => (
    <div key={name} className={clsx('plitzi-component__sign-in-form-field', styleSelectors.field)}>
      <label className={clsx('plitzi-component__sign-in-form-label', styleSelectors.label)} htmlFor={`${id}-${name}`}>
        {label}
      </label>
      <input
        id={`${id}-${name}`}
        name={name}
        className={clsx('plitzi-component__sign-in-form-input', styleSelectors.input)}
        required
        {...input}
      />
    </div>
  );

  const submitClass = clsx('plitzi-component__sign-in-form-submit', styleSelectors.submit);
  const said = unset ? 'Signing in is not set up for this site.' : problem;

  return (
    <RootElement ref={ref} className={clsx('plitzi-component__sign-in-form', className)}>
      {outAndBack ? (
        <button type="button" className={submitClass} onClick={() => void auth.login?.({})}>
          {submitLabel}
        </button>
      ) : (
        <form
          className="plitzi-component__sign-in-form-fields"
          onSubmit={event => void handleSubmit(event)}
          noValidate={editing}
        >
          {mfaToken
            ? field('code', codeLabel, { type: 'text', inputMode: 'numeric', autoComplete: 'one-time-code' })
            : [
                field('username', usernameLabel, { type: 'email', autoComplete: 'username' }),
                field('password', passwordLabel, { type: 'password', autoComplete: 'current-password' })
              ]}
          <button type="submit" className={submitClass} disabled={busy || unset}>
            {submitLabel}
          </button>
        </form>
      )}
      <p className={clsx('plitzi-component__sign-in-form-problem', styleSelectors.problem)} role="alert">
        {said}
      </p>
    </RootElement>
  );
};

export default withElement(SignInForm);

export { SignInForm };
