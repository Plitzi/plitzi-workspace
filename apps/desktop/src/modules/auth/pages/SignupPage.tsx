import { Link } from 'react-router-dom';

import { usePageLayout } from '../../../Layout/useLayout';
import SignupForm from '../forms/SignupForm';

const SignupPage = () => {
  usePageLayout({ intent: 'login', title: 'Create an account' });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Create an account</h1>
      <SignupForm />
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        Already have one?{' '}
        <Link to="/" className="font-semibold text-indigo-600 hover:underline">
          Sign in
        </Link>
      </span>
    </div>
  );
};

export default SignupPage;
