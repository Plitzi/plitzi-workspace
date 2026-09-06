import { Navigate, Route, Routes } from 'react-router-dom';

import ForgotPasswordPage from './pages/ForgotPasswordPage';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SignupPage from './pages/SignupPage';
import ValidateAccountPage from './pages/ValidateAccountPage';
import VerificationEmailPage from './pages/VerificationEmailPage';
import useAuth from './useAuth';

/**
 * The sign-in flows.
 *
 * Two of them stay reachable with a session — verifying an account and finishing a password reset both happen
 * from a link in an email, and the person who clicks it may well be signed in on this machine already. The 2023
 * routes hid every one of them behind `!isAuthenticated`, so those two links silently redirected home.
 */
const AuthRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="validate-account" element={<ValidateAccountPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />
      {!isAuthenticated && <Route path="login" element={<LoginPage />} />}
      {!isAuthenticated && <Route path="signup" element={<SignupPage />} />}
      {!isAuthenticated && <Route path="forgot-password" element={<ForgotPasswordPage />} />}
      {!isAuthenticated && <Route path="confirmation-email" element={<VerificationEmailPage />} />}
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
};

export default AuthRoutes;
