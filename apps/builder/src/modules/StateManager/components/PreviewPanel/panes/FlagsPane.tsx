import clsx from 'clsx';
import { useCallback } from 'react';

import { withForcedFlag } from '@plitzi/sdk-shared/flags';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import FlagPreviewToggle from '@pmodules/Flags/components/FlagItem/FlagPreviewToggle';

import type { FlagResolution } from '@plitzi/sdk-shared/flags';

const NONE: Record<string, boolean> = {};

/** Why a flag answers what it does for the preview's visitor, in a few words. */
const reasonOf = (resolution: FlagResolution | undefined): string => {
  if (!resolution) {
    return '';
  }

  if (resolution.layer === 'qa') {
    return 'forced here';
  }

  if (resolution.rollout) {
    return 'its rollout';
  }

  return resolution.rule === undefined ? 'its default' : `rule ${String(resolution.rule + 1)}`;
};

/**
 * The space's feature flags as the preview's visitor gets them — on or off, and why — each forced on or off here for
 * the canvas alone: never saved, never published.
 */
const FlagsPane = () => {
  const [[declared, resolved]] = useBuilderStore(['schema.flags', 'flags.resolved']);
  const [forced = NONE, setForced] = useBuilderStore('flags.overrides.qa');
  const names = Object.keys(declared ?? {});

  const handleForce = useCallback(
    (name: string, value: boolean | undefined) => setForced(withForcedFlag(forced, name, value)),
    [forced, setForced]
  );

  if (names.length === 0) {
    return (
      <p className="text-ui-fg-subtle px-1 text-[11px]">
        This space declares no feature flag. Add one in Feature Flags to switch it here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {names.map(name => {
        const resolution = resolved?.[name];
        const on = resolution?.value ?? false;

        return (
          <li key={name} className="border-ui-line flex items-center gap-2 rounded-lg border px-2.5 py-2">
            <span
              className={clsx('size-2 shrink-0 rounded-full', { 'bg-emerald-500': on, 'bg-ui-line-strong': !on })}
              aria-hidden
            />
            <span className="flex min-w-0 grow flex-col">
              <span className="text-ui-fg truncate font-mono text-xs">{name}</span>
              <span className="text-ui-fg-subtle text-[10px]">
                {on ? 'On' : 'Off'} · {reasonOf(resolution)}
              </span>
            </span>
            <FlagPreviewToggle name={name} forced={forced[name]} onForce={handleForce} />
          </li>
        );
      })}
    </ul>
  );
};

export default FlagsPane;
