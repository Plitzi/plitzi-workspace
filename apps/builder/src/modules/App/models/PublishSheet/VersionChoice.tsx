import clsx from 'clsx';
import { useCallback } from 'react';

import RevisionOption from './RevisionOption';
import { ENVIRONMENT_META } from '../../helpers/environments';

import type { PublishedEnvironment } from '../../helpers/environments';
import type { SpaceSnapshot } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type VersionChoiceProps = {
  domain: string;
  environment: PublishedEnvironment;
  /** The environment's newest version, when it has one. */
  latest: SpaceSnapshot | undefined;
  /** Follows the latest, or stays on one. */
  follows: boolean;
  revision: number | undefined;
  snapshots: readonly SpaceSnapshot[];
  loading: boolean;
  onFollow: (follows: boolean) => void;
  onPick: (revision: number) => void;
};

type ChoiceProps = { chosen: boolean; title: string; detail: string; onChoose: () => void; children?: ReactNode };

/** One answer, as a radio with its words; what it asks for opens under it while chosen. */
const Choice = ({ chosen, title, detail, onChoose, children }: ChoiceProps) => (
  <div
    className={clsx(
      'flex flex-col rounded-lg border transition-colors',
      chosen ? 'border-primary-500 bg-primary-500/5' : 'border-ui-line hover:bg-ui-hover'
    )}
  >
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      className="focus-visible:ring-primary-500 flex items-start gap-2.5 rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-2"
      onClick={onChoose}
    >
      <span
        aria-hidden
        className={clsx(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
          chosen ? 'border-primary-500' : 'border-ui-line-strong'
        )}
      >
        {chosen && <span className="bg-primary-500 size-2 rounded-full" />}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-ui-fg text-sm font-medium">{title}</span>
        <span className="text-ui-fg-subtle text-xs">{detail}</span>
      </span>
    </button>
    {chosen && children && <div className="px-2 pb-2">{children}</div>}
  </div>
);

/**
 * Which version of the environment the domain shows: always its latest — each one kept there shows at once — or one
 * chosen from its list, which it stays on until another publish.
 */
const VersionChoice = ({
  domain,
  environment,
  latest,
  follows,
  revision,
  snapshots,
  loading,
  onFollow,
  onPick
}: VersionChoiceProps) => {
  const label = ENVIRONMENT_META[environment].label;
  const handleLatest = useCallback(() => onFollow(true), [onFollow]);
  const handleSpecific = useCallback(() => onFollow(false), [onFollow]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-ui-fg text-sm font-medium">Version</span>
      <div role="radiogroup" aria-label="Version" className="flex flex-col gap-1.5">
        <Choice
          chosen={follows}
          title="Latest"
          detail={`Always the newest ${label} version${latest ? ` — v${String(latest.revision)} now` : ''}. Each one you keep there shows at once.`}
          onChoose={handleLatest}
        />
        <Choice
          chosen={!follows}
          title="A specific version"
          detail="Stays on the one you choose until you publish another."
          onChoose={handleSpecific}
        >
          {loading && <span className="text-ui-fg-subtle px-1 text-xs">Reading the versions…</span>}
          {!loading && snapshots.length === 0 && (
            <span className="text-ui-fg-subtle px-1 text-xs">
              No {label} versions yet: choose Latest to keep your changes as the first.
            </span>
          )}
          <ul
            role="radiogroup"
            aria-label={`${label} versions`}
            className="flex max-h-56 flex-col gap-0.5 overflow-y-auto"
          >
            {snapshots.map(snapshot => (
              <RevisionOption
                key={snapshot.revision}
                snapshot={snapshot}
                chosen={snapshot.revision === revision}
                domain={domain}
                onPick={onPick}
              />
            ))}
          </ul>
        </Choice>
      </div>
    </div>
  );
};

export default VersionChoice;
