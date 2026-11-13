import { contentsRows } from './helpers';
import PluginList from './PluginList';
import useVersionContents from './useVersionContents';

import type { Environment } from '@plitzi/sdk-shared';

const MUTED = 'text-ui-fg-subtle';

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
    <section className="border-ui-line flex flex-col gap-2 rounded-md border p-3">
      <h5 className={`text-[11px] font-bold tracking-wider uppercase ${MUTED}`}>{title}</h5>
      {loading && <p className={`text-xs ${MUTED}`}>Reading what it holds…</p>}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">What it holds could not be read ({error.message}).</p>
      )}
      {contents && (
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
          {contentsRows(contents).map(row => (
            <div key={row.label} className="contents">
              <dt className={MUTED}>{row.label}</dt>
              <dd className="text-ui-fg">{row.value}</dd>
            </div>
          ))}
          <dt className={MUTED}>Plugins</dt>
          <dd>
            {contents.plugins.length > 0 && <PluginList plugins={contents.plugins} />}
            {contents.plugins.length === 0 && <span className="text-ui-fg">None</span>}
          </dd>
        </dl>
      )}
      <p className={`text-[11px] ${MUTED}`}>
        Not frozen with it — every version shares them: the space’s files on its CDN, its variables and credentials.
      </p>
    </section>
  );
};

export default VersionContents;
