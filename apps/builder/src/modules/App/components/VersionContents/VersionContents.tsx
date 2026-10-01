import { contentsRows } from './helpers';
import PluginList from './PluginList';
import useVersionContents from './useVersionContents';

import type { Environment } from '@plitzi/sdk-shared';

const MUTED = 'text-zinc-500 dark:text-zinc-400';

export type VersionContentsProps = {
  environment: Environment;
  /** A snapshot's revision; an environment's latest when left out. Meaningless for the draft. */
  revision?: number;
  /** What the list is: "This snapshot will freeze", "production r3 holds". */
  title: string;
};

/**
 * What one version of the space holds — the draft a snapshot would freeze, or a snapshot as it was frozen — and what no
 * version holds, because every version shares it. Read from the platform, which is what freezes it.
 */
const VersionContents = ({ environment, revision, title }: VersionContentsProps) => {
  const { contents, loading, error } = useVersionContents(environment, revision);

  return (
    <section className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
      <h5 className={`text-[10px] font-bold tracking-wider uppercase ${MUTED}`}>{title}</h5>
      {loading && <p className={`text-xs ${MUTED}`}>Reading what it holds…</p>}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">What it holds could not be read ({error.message}).</p>
      )}
      {contents && (
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
          {contentsRows(contents).map(row => (
            <div key={row.label} className="contents">
              <dt className={MUTED}>{row.label}</dt>
              <dd className="text-zinc-800 dark:text-zinc-100">{row.value}</dd>
            </div>
          ))}
          <dt className={MUTED}>Plugins</dt>
          <dd>
            {contents.plugins.length > 0 && <PluginList plugins={contents.plugins} />}
            {contents.plugins.length === 0 && <span className="text-zinc-800 dark:text-zinc-100">None</span>}
          </dd>
        </dl>
      )}
      <p className={`text-[11px] ${MUTED}`}>
        Not frozen with it — every version shares them: the space’s files on its CDN, its variables and credentials, and
        its segments, which are published on their own.
      </p>
    </section>
  );
};

export default VersionContents;
