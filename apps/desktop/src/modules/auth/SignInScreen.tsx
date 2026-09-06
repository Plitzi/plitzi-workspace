import Button from '@plitzi/plitzi-ui/Button';
import { useCallback, useState } from 'react';

import useAuth from './useAuth';

/**
 * The whole of signing in, in this window: one button.
 *
 * There is no form here, and that is the point. The window opens the person's own browser at the platform's
 * sign-in — the same screen the dashboard and the MCP connector send people to — and waits for a session to come
 * back on a loopback address. So this app never sees a password, MFA and social sign-in work without it knowing
 * they exist, and there is one screen to maintain instead of one per surface.
 *
 * It used to be six screens and four forms: sign in, sign up, forgot, reset, verify, resend.
 */
const SignInScreen = () => {
  const { signIn } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSignIn = useCallback(async () => {
    setPending(true);
    setError(undefined);
    const result = await signIn();
    // Left pending on success: the window is about to re-render as the signed-in app, and flipping the button
    // back first shows "Sign in" to somebody who just did.
    if (!result.ok) {
      setPending(false);
      setError(result.error ?? 'That sign-in did not complete.');
    }
  }, [signIn]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Plitzi</h1>
      <p className="max-w-sm text-center text-sm text-zinc-500">
        Signing in happens in your browser, so this app never handles your password.
      </p>
      <Button onClick={handleSignIn} disabled={pending} className="min-w-56">
        {pending ? 'Waiting for your browser…' : 'Sign in with your browser'}
      </Button>
      {error && <p className="max-w-sm text-center text-sm text-red-500">{error}</p>}
      {pending && (
        <button type="button" className="text-xs text-zinc-500 underline" onClick={() => setPending(false)}>
          Start over
        </button>
      )}
    </div>
  );
};

export default SignInScreen;
