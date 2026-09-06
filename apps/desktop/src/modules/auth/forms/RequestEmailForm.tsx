import Button from '@plitzi/plitzi-ui/Button';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import type { ApiResult } from '@pmodules/network';

export type RequestEmailFormProps = {
  submitLabel: string;
  /** Shown once the request went through. Deliberately the same whether or not the address exists. */
  doneMessage: string;
  onSubmit: (email: string) => Promise<ApiResult<unknown>>;
};

/**
 * "Send me an email about this address."
 *
 * One component for the two flows that are the same shape — a forgotten password and a verification link that
 * never arrived. Both answer identically whether or not the address is registered, which is the point: an
 * endpoint that says "no such account" is an endpoint that enumerates accounts.
 */
const RequestEmailForm = ({ submitLabel, doneMessage, onSubmit }: RequestEmailFormProps) => {
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<{ email: string }>();

  const submit = handleSubmit(async ({ email }) => {
    setFailure(undefined);
    const result = await onSubmit(email);
    if (!result.ok && result.status === 0) {
      setFailure('Could not reach Plitzi. Check your connection and try again.');

      return;
    }

    setDone(true);
  });

  if (done) {
    return <p className="text-sm text-zinc-700 dark:text-zinc-200">{doneMessage}</p>;
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={e => void submit(e)}>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">Email</span>
        <input
          type="email"
          autoComplete="email"
          autoFocus
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
          {...register('email', { required: 'We need an address to send it to.' })}
        />
        {errors.email && <span className="text-xs text-red-600">{errors.email.message}</span>}
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
        {isSubmitting ? 'Sending…' : submitLabel}
      </Button>
    </form>
  );
};

export default RequestEmailForm;
