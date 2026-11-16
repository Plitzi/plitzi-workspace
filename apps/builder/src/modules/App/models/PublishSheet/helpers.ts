import { revisionName } from '../../helpers/environments';

import type { DeployMode, DeployStatus, SpaceServedVersion, SpaceTarget } from '@plitzi/sdk-shared';

/** How a target serves the space, in a few words. */
export const MODE_WORDS: Record<DeployMode, string> = {
  ssr: 'Plitzi',
  spa: 'Single-page app',
  static: 'Prerendered',
  selfHosted: 'Your server'
};

/** `production r12`, or the draft. */
export const versionName = ({ environment, revision }: SpaceServedVersion): string =>
  environment === 'main' ? 'the draft' : revisionName(environment, revision);

/** Where a target's site is and how it is served: `GitHub Pages · Single-page app`, or `Plitzi`. */
export const targetWhere = (target: Pick<SpaceTarget, 'mode' | 'providerLabel'>): string =>
  target.mode === 'ssr' ? 'Plitzi' : `${target.providerLabel} · ${MODE_WORDS[target.mode]}`;

/** A deploy's state in words, and whether it is still going. */
export const deployWords = (status: DeployStatus): { words: string; going: boolean } =>
  ({
    queued: { words: 'Waiting to start', going: true },
    building: { words: 'Building the site', going: true },
    uploading: { words: 'Uploading', going: true },
    succeeded: { words: 'Live', going: false },
    failed: { words: 'Failed', going: false },
    canceled: { words: 'Canceled', going: false }
  })[status];

/** The steps a deploy goes through, and where this one is among them: what the progress view ticks. */
export const deploySteps = (
  status: DeployStatus
): { label: string; state: 'done' | 'current' | 'todo' | 'failed' }[] => {
  const order: DeployStatus[] = ['queued', 'building', 'uploading', 'succeeded'];
  const labels = ['Queued', 'Built', 'Uploaded', 'Live'];
  const at = order.indexOf(status);
  const stopped = status === 'failed' || status === 'canceled';

  return labels.map((label, index) => ({
    label,
    state:
      at === -1
        ? stopped && index === 0
          ? 'done'
          : stopped && index === 1
            ? 'failed'
            : 'todo'
        : index < at || status === 'succeeded'
          ? 'done'
          : index === at
            ? 'current'
            : 'todo'
  }));
};
