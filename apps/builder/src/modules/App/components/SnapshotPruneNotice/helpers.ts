import { PUBLISHED_ENVIRONMENTS, revisionName } from '../../helpers/environments';

import type { NextPrune } from '@pmodules/Space/hooks/useNextPrune';

/** `version 2 (2 Oct 2026)`: a saved version as the dialog names it. */
export const snapshotName = ({ environment, revision, publishedAt }: NextPrune['removes'][number]): string => {
  const known = PUBLISHED_ENVIRONMENTS.find(each => each === environment);

  return `${known ? revisionName(known, revision) : `${environment} version ${String(revision)}`} (${new Date(publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })})`;
};

/** What saving the next version removes, said in a sentence; empty when it removes nothing. */
export const pruneSentence = (prune: NextPrune): string => {
  if (prune.removes.length === 0) {
    return '';
  }

  const kept = prune.keep === 0 ? 'keeps no unpublished versions' : `keeps ${String(prune.keep)} unpublished versions`;

  return `This space's plan ${kept}: saving this one removes ${prune.removes.map(snapshotName).join(', ')}. A version a domain shows is always kept.`;
};
