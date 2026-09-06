import Button from '@plitzi/plitzi-ui/Button';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import useAuth from '../useAuth';

type SignupFields = { username: string; email: string; password: string };

const SignupForm = () => {
  const { signup } = useAuth();
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<SignupFields>();

  const onSubmit = handleSubmit(async fields => {
    setFailure(undefined);
    const result = await signup(fields);
    if (!result.ok) {
      setFailure(
        result.status === 0
          ? 'Could not reach Plitzi. Check your connection and try again.'
          : (result.error ?? 'Could not create that account.')
      );

      return;
    }

    setDone(true);
  });

  if (done) {
    return (
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-zinc-700 dark:text-zinc-200">
          Your account is created. Check your email for the link that verifies it, then sign in.
        </p>
        <Link to="/" className="font-semibold text-indigo-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={e => void onSubmit(e)}>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">Username</span>
        <input
          type="text"
          autoComplete="username"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
          {...register('username', { required: 'Pick a username.' })}
        />
        {errors.username && <span className="text-xs text-red-600">{errors.username.message}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">Email</span>
        <input
          type="email"
          autoComplete="email"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
          {...register('email', { required: 'We need an address to verify.' })}
        />
        {errors.email && <span className="text-xs text-red-600">{errors.email.message}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">Password</span>
        <input
          type="password"
          autoComplete="new-password"
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
        {isSubmitting ? 'Creating…' : 'Create account'}
      </Button>
    </form>
  );
};

export default SignupForm;
