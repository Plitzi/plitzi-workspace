import { Link } from 'react-router-dom';

import { usePageLayout } from '../../../Layout/useLayout';
import RequestEmailForm from '../forms/RequestEmailForm';
import useAuth from '../useAuth';

const ForgotPasswordPage = () => {
  const { auth } = useAuth();
  usePageLayout({ intent: 'login', title: 'Forgotten password' });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Forgotten password</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Give us the address on the account and we will send a link to set a new password.
      </p>
      <RequestEmailForm
        submitLabel="Send the link"
        doneMessage="If that address has an account, the link is on its way. Open it in this app or in your browser."
        onSubmit={auth.forgotPassword}
      />
      <Link to="/" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
        Back to sign in
      </Link>
    </div>
  );
};

export default ForgotPasswordPage;
