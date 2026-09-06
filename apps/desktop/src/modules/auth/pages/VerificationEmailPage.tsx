import { Link } from 'react-router-dom';

import { usePageLayout } from '../../../Layout/useLayout';
import RequestEmailForm from '../forms/RequestEmailForm';
import useAuth from '../useAuth';

const VerificationEmailPage = () => {
  const { auth } = useAuth();
  usePageLayout({ intent: 'login', title: 'Verification email' });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Verification email</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Give us the address you signed up with and we will send the link again.
      </p>
      <RequestEmailForm
        submitLabel="Send it again"
        doneMessage="If that address needs verifying, the link is on its way."
        onSubmit={auth.resendVerification}
      />
      <Link to="/" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
        Back to sign in
      </Link>
    </div>
  );
};

export default VerificationEmailPage;
