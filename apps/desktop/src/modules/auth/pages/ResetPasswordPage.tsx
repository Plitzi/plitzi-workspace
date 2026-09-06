import { Link, useSearchParams } from 'react-router-dom';

import { usePageLayout } from '../../../Layout/useLayout';
import ResetPasswordForm from '../forms/ResetPasswordForm';

/**
 * Reached from a link in an email, which in a desktop window means a deep link the shell handed over.
 *
 * A missing token is shown rather than redirected away. The 2023 page pushed a toast and navigated to sign-in,
 * which throws away the one piece of evidence — the URL that was opened — that could tell somebody what went
 * wrong with the link they clicked.
 */
const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  usePageLayout({ intent: 'login', title: 'New password' });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Set a new password</h1>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This link carries no token, so there is nothing to reset. Ask for a new link and open the whole address from
          the email.
        </p>
      )}
      <Link to="/" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
        Back to sign in
      </Link>
    </div>
  );
};

export default ResetPasswordPage;
