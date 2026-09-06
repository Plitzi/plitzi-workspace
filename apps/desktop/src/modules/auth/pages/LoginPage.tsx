import { Link } from 'react-router-dom';

import { usePageLayout } from '../../../Layout/useLayout';
import LoginForm from '../forms/LoginForm';

const LoginPage = () => {
  usePageLayout({ intent: 'login', title: 'Sign in' });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Sign in</h1>
      <LoginForm />
      <div className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <Link to="/auth/forgot-password" className="hover:underline">
          I forgot my password
        </Link>
        <Link to="/auth/confirmation-email" className="hover:underline">
          Send my verification email again
        </Link>
        <span>
          No account yet?{' '}
          <Link to="/auth/signup" className="font-semibold text-indigo-600 hover:underline">
            Create one
          </Link>
        </span>
      </div>
    </div>
  );
};

export default LoginPage;
