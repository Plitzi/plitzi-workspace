import type { NextPrune } from '@pmodules/Space/hooks/useNextPrune';

/** `production:2 (2 Oct 2026)`: a snapshot as the dialog names it. */
export const snapshotName = ({ environment, revision, publishedAt }: NextPrune['removes'][number]): string =>
  `${environment}:${String(revision)} (${new Date(publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })})`;

/** What the next snapshot removes, said in a sentence; empty when it removes nothing. */
export const pruneSentence = (prune: NextPrune): string => {
  if (prune.removes.length === 0) {
    return '';
  }

  const kept =
    prune.keep === 0 ? 'keeps no unpublished snapshots' : `keeps ${String(prune.keep)} unpublished snapshots`;

  return `This space's plan ${kept}: taking this one removes ${prune.removes.map(snapshotName).join(', ')}. A snapshot a domain serves is always kept.`;
};
