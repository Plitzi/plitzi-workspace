import Button from '@plitzi/plitzi-ui/Button';
import { memo, useCallback } from 'react';

import EmptyState from '@pmodules/App/components/EmptyState';

import type { BuilderRefusal as Refusal } from './refusalOf';

const ICON: Record<Refusal['kind'], string> = {
  signedOut: 'fa-solid fa-right-to-bracket',
  notFound: 'fa-solid fa-folder-open',
  unreachable: 'fa-solid fa-plug-circle-xmark',
  other: 'fa-solid fa-triangle-exclamation'
};

export type BuilderRefusalProps = { refusal: Refusal; onRetry: () => void };

/**
 * What the builder draws when it cannot open its space: the reason, and the way out — never the bare words of an error
 * on an empty page, which is what a credential the server no longer took drew. The builder is opened from the console's
 * page, so going back is its home, and signing in again is that page asked for anew: it sends whoever is signed out to
 * sign in, and back here after.
 */
const BuilderRefusal = ({ refusal, onRetry }: BuilderRefusalProps) => {
  const handleSignIn = useCallback(() => {
    window.location.reload();
  }, []);
  const handleBack = useCallback(() => {
    window.location.assign('/');
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-zinc-900" role="alert">
      <EmptyState
        icon={ICON[refusal.kind]}
        title={refusal.title}
        description={refusal.description}
        action={
          <>
            {refusal.kind === 'signedOut' && (
              <Button size="sm" onClick={handleSignIn}>
                Sign in again
              </Button>
            )}
            {(refusal.kind === 'unreachable' || refusal.kind === 'other') && (
              <Button size="sm" onClick={onRetry}>
                Try again
              </Button>
            )}
            <Button size="sm" intent="secondary" onClick={handleBack}>
              Back to your spaces
            </Button>
          </>
        }
      />
    </div>
  );
};

export default memo(BuilderRefusal);
