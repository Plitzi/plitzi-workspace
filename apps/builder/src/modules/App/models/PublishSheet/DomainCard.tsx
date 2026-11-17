import clsx from 'clsx';
import { useCallback } from 'react';

import { showsWords, targetWhere } from './helpers';
import { targetAttention } from '../../components/AppHeader/ReleaseCluster/targetAttention';
import { shortAge } from '../../helpers/age';
import { ENVIRONMENT_META } from '../../helpers/environments';

import type { SpaceTarget } from '@plitzi/sdk-shared';

export type DomainCardProps = {
  target: SpaceTarget;
  chosen: boolean;
  onChoose: (domain: string) => void;
  /** Its hosting: Plitzi's page servers, or a copy on a provider. Absent for a host of Plitzi's own. */
  onSettings?: (domain: string) => void;
};

const TONE_TEXT = {
  danger: 'text-red-700 dark:text-red-300',
  warning: 'text-amber-700 dark:text-amber-300',
  progress: 'text-sky-700 dark:text-sky-300'
} as const;

/** One domain to publish to, as a row of the list: what it shows now, where it is hosted, and what it asks for. */
const DomainCard = ({ target, chosen, onChoose, onSettings }: DomainCardProps) => {
  const asks = targetAttention([target]).at(0);
  const shown = target.serves?.environment;

  const handleChoose = useCallback(() => onChoose(target.domain), [onChoose, target.domain]);
  const handleSettings = useCallback(() => onSettings?.(target.domain), [onSettings, target.domain]);

  return (
    <li
      className={clsx(
        'flex items-stretch transition-colors',
        chosen ? 'bg-primary-500/10 shadow-primary-500 shadow-[inset_3px_0_0]' : 'hover:bg-ui-hover'
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={chosen}
        className="focus-visible:ring-primary-500 flex min-w-0 grow items-center gap-2.5 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
        onClick={handleChoose}
      >
        <span
          aria-hidden
          className={clsx(
            'flex size-4 shrink-0 items-center justify-center rounded-full border',
            chosen ? 'border-primary-500' : 'border-ui-line-strong'
          )}
        >
          {chosen && <span className="bg-primary-500 size-2 rounded-full" />}
        </span>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-ui-fg truncate text-sm font-semibold">{target.domain}</span>
          {target.verified ? (
            <span className="text-ui-fg-subtle flex min-w-0 items-center gap-1.5 text-xs">
              {shown && <span className={clsx('size-1.5 shrink-0 rounded-full', ENVIRONMENT_META[shown].dot)} />}
              <span className="truncate">
                {showsWords(target)}
                {target.mode !== 'ssr' ? ` · on ${targetWhere(target)}` : ''}
                {target.lastDeploy?.finishedAt
                  ? ` · deployed ${shortAge(target.lastDeploy.finishedAt * 1000)} ago`
                  : ''}
              </span>
            </span>
          ) : (
            <span className={clsx('text-xs', TONE_TEXT.warning)}>
              <i className="fa-solid fa-triangle-exclamation mr-1" aria-hidden />
              Not connected yet: its DNS record is missing
            </span>
          )}
          {asks && <span className={clsx('truncate text-xs', TONE_TEXT[asks.tone])}>{asks.words}</span>}
        </span>
      </button>
      {onSettings && (
        <button
          type="button"
          title={`Settings of ${target.domain}: where it is hosted, and its automation`}
          aria-label={`Settings of ${target.domain}`}
          className="text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover my-1.5 mr-1.5 flex w-8 shrink-0 items-center justify-center rounded-md"
          onClick={handleSettings}
        >
          <i className="fa-solid fa-sliders" aria-hidden />
        </button>
      )}
    </li>
  );
};

export default DomainCard;
