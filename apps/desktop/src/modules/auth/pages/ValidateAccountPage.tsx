import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { usePageLayout } from '../../../Layout/useLayout';
import useAuth from '../useAuth';

type Outcome = 'checking' | 'verified' | 'invalid' | 'missing' | 'unreachable';

const MESSAGES: Record<Exclude<Outcome, 'checking'>, string> = {
  verified: 'Your account is verified. Sign in and your spaces will be here.',
  invalid: 'That link is no longer valid. Ask for a new verification email and open the newest one.',
  missing: 'This link carries no token, so there is nothing to verify.',
  unreachable: 'Could not reach Plitzi to verify this. Check your connection and open the link again.'
};

const ValidateAccountPage = () => {
  const { auth } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [outcome, setOutcome] = useState<Outcome>(token ? 'checking' : 'missing');
  usePageLayout({ intent: 'login', title: 'Verify your account' });

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    const verify = async () => {
      const result = await auth.validateAccount(token);
      if (cancelled) {
        return;
      }

      setOutcome(result.ok ? 'verified' : result.status === 0 ? 'unreachable' : 'invalid');
    };

    void verify();

    return () => {
      cancelled = true;
    };
  }, [auth, token]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Verify your account</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {outcome === 'checking' ? 'Checking that link…' : MESSAGES[outcome]}
      </p>
      <Link to="/" className="text-sm font-semibold text-indigo-600 hover:underline">
        Back to sign in
      </Link>
    </div>
  );
};

export default ValidateAccountPage;
