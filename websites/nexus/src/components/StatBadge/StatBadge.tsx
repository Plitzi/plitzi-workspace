import { type ReactNode, useCallback } from 'react';

import formatCount from './formatCount';
import useCountUp from './useCountUp';
import useLiveStat from './useLiveStat';

export type StatBadgeProps = {
  cacheKey: string;
  url: string;
  extract: (data: unknown) => number | undefined;
  label: string;
  href: string;
  icon: ReactNode;
};

const StatBadge = ({ cacheKey, url, extract, label, href, icon }: StatBadgeProps) => {
  const resolver = useCallback(extract, [extract]);
  const value = useLiveStat(cacheKey, url, resolver);
  const animated = useCountUp(value);
  const loaded = value !== null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group border-ink-600 bg-ink-800/60 hover:border-brand-500 hover:bg-ink-800 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium text-zinc-300 transition"
    >
      <span className="text-brand-400 flex items-center">{icon}</span>

      {!loaded && <span className="bg-ink-600 h-3 w-8 animate-pulse rounded" aria-hidden />}
      {loaded && <span className="stat-pop tabular-nums font-semibold text-white">{formatCount(animated)}</span>}

      <span className="text-zinc-500 group-hover:text-zinc-400">{label}</span>
    </a>
  );
};

export default StatBadge;
