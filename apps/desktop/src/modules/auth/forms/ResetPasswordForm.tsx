import Button from '@plitzi/plitzi-ui/Button';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import useAuth from '../useAuth';

export type ResetPasswordFormProps = { token: string };

const ResetPasswordForm = ({ token }: ResetPasswordFormProps) => {
  const { auth } = useAuth();
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<{ password: string; confirmation: string }>();

  /**
   * The two fields are compared on submit rather than by a `validate` that reads `watch()`.
   *
   * `watch` returns a function React Compiler cannot memoize, so a rule about it hangs over every component that
   * uses one — and the comparison does not need to happen on every keystroke anyway. Submitting is the moment the
   * answer matters.
   */
  const submit = handleSubmit(async ({ password, confirmation }) => {
    if (password !== confirmation) {
      setError('confirmation', { message: 'The two do not match.' });

      return;
    }

    setFailure(undefined);
    const result = await auth.resetPassword(token, password);
    if (!result.ok) {
      setFailure(
        result.status === 0
          ? 'Could not reach Plitzi. Check your connection and try again.'
          : (result.error ?? 'That link is no longer valid. Ask for a new one.')
      );

      return;
    }

    setDone(true);
  });

  if (done) {
    return (
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-zinc-700 dark:text-zinc-200">Your password is changed. Sign in with the new one.</p>
        <Link to="/" className="font-semibold text-indigo-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={e => void submit(e)}>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">New password</span>
        <input
          type="password"
          autoComplete="new-password"
          autoFocus
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
          {...register('password', { required: 'A password is required.' })}
        />
        {errors.password && <span className="text-xs text-red-600">{errors.password.message}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">Repeat it</span>
        <input
          type="password"
          autoComplete="new-password"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
          {...register('confirmation')}
        />
        {errors.confirmation && <span className="text-xs text-red-600">{errors.confirmation.message}</span>}
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
        {isSubmitting ? 'Saving…' : 'Change my password'}
      </Button>
    </form>
  );
};

export default ResetPasswordForm;
