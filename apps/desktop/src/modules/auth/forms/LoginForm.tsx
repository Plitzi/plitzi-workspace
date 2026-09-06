import Button from '@plitzi/plitzi-ui/Button';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import useAuth from '../useAuth';

type LoginFields = { username: string; password: string };

/**
 * What a refused sign-in says, in the deployment's own vocabulary.
 *
 * Every 401 from this server names a `reason`, and the ones a person can act on are worth saying properly —
 * "your account has not been verified" is a different instruction from "that password is wrong". Anything not
 * listed falls back to the generic line rather than showing a machine word.
 */
const REASONS: Record<string, string | undefined> = {
  credentials: 'That username or password is not right.',
  unverified: 'This account has not been verified yet. Check your email for the link.',
  banned: 'This account has been suspended.',
  locked: 'Too many attempts. Try again in a few minutes.',
  throttled: 'Too many attempts. Try again in a few minutes.',
  mfaRequired: 'This account needs a second factor, which this app cannot ask for yet. Sign in on the web.',
  unreachable: 'Could not reach Plitzi. Check your connection and try again.'
};

const LoginForm = () => {
  const { login } = useAuth();
  const [failure, setFailure] = useState<string | undefined>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFields>();

  const onSubmit = handleSubmit(async ({ username, password }) => {
    setFailure(undefined);
    const result = await login(username, password);
    if (!result.ok) {
      setFailure(REASONS[result.reason ?? ''] ?? result.error ?? 'Could not sign you in.');
    }
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={e => void onSubmit(e)}>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">Username or email</span>
        <input
          type="text"
          autoComplete="username"
          autoFocus
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
          {...register('username', { required: 'Tell us who you are.' })}
        />
        {errors.username && <span className="text-xs text-red-600">{errors.username.message}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
          {...register('password', { required: 'A password is required.' })}
        />
        {errors.password && <span className="text-xs text-red-600">{errors.password.message}</span>}
      </label>
      {failure && (
        <div
          role="alert"
          className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {failure}
        </div>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
};

export default LoginForm;
