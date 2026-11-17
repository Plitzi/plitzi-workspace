import clsx from 'clsx';

import { ageAgo } from '../../helpers/age';
import { revisionName } from '../../helpers/environments';

import type { SpaceRelease, SpaceServedVersion } from '@plitzi/sdk-shared';

export type ReleaseHistoryProps = {
  domain: string;
  releases: readonly SpaceRelease[];
  loading: boolean;
  /** Puts a version back on the domain — after the sheet asks to be sure. */
  onServeAgain: (version: SpaceServedVersion) => void;
  /** Shown open: the sheet's history view, rather than a fold under the publish. */
  open?: boolean;
};

/** `production r12`, or the draft. */
const versionName = ({ environment, revision }: SpaceServedVersion) =>
  environment === 'main' ? 'the draft' : revisionName(environment, revision);

/**
 * A domain's releases, newest first: what each put on it, who, when, and whether it was a publish or a rollback — every
 * one but the live one with the way to serve it again.
 */
const ReleaseHistory = ({ domain, releases, loading, onServeAgain, open = false }: ReleaseHistoryProps) => (
  <details className="text-xs" open={open}>
    <summary className="text-ui-fg-subtle hover:text-ui-fg w-fit cursor-pointer">
      What was published on {domain}, and when
    </summary>
    <div className="mt-2 flex flex-col gap-1">
      {loading && <span className="text-ui-fg-subtle">Reading the history…</span>}
      {!loading && releases.length === 0 && (
        <span className="text-ui-fg-subtle">
          Nothing published on {domain} yet: its first publish starts its history.
        </span>
      )}
      {releases.map((release, index) => (
        <div
          key={release.id}
          className={clsx('flex items-center gap-2 rounded-md px-2 py-1.5', index === 0 && 'bg-emerald-500/10')}
        >
          <span className="flex min-w-0 grow flex-col">
            <span className="text-ui-fg truncate">
              {release.kind === 'rollback' ? 'Rolled back to ' : 'Published '}
              <b>{versionName(release)}</b>
              {release.deployId ? <span className="text-ui-fg-subtle"> · deploy #{release.deployId}</span> : null}
              {index === 0 && <span className="text-emerald-700 dark:text-emerald-300"> · live</span>}
            </span>
            <span className="text-ui-fg-subtle truncate">
              {[release.by?.username, ageAgo(release.at * 1000)].filter(Boolean).join(' · ')}
            </span>
          </span>
          {index > 0 && (
            <button
              type="button"
              className="border-ui-line text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover shrink-0 rounded-md border px-2 py-1"
              onClick={() => onServeAgain({ environment: release.environment, revision: release.revision })}
            >
              Serve this again
            </button>
          )}
        </div>
      ))}
    </div>
  </details>
);

export default ReleaseHistory;
