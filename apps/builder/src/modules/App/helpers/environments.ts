import type { Environment } from '@plitzi/sdk-shared';

/** An environment a snapshot is kept in: every one but the draft. */
export type PublishedEnvironment = Exclude<Environment, 'main'>;

/** The published environments, the one furthest from the public first — the order the snapshot modal offers them in. */
export const PUBLISHED_ENVIRONMENTS: readonly PublishedEnvironment[] = ['development', 'staging', 'production'];

/**
 * How an environment is named and marked wherever releases are shown: its words, its icon and the colour of its dot —
 * the draft (`main`) is the draft, never an environment like the others.
 */
export const ENVIRONMENT_META: Readonly<Record<Environment, { label: string; icon: string; dot: string }>> = {
  main: { label: 'Draft', icon: 'fa-solid fa-pen-ruler', dot: 'bg-violet-500' },
  development: { label: 'Development', icon: 'fa-solid fa-code', dot: 'bg-sky-500' },
  staging: { label: 'Staging', icon: 'fa-solid fa-vial', dot: 'bg-amber-500' },
  production: { label: 'Production', icon: 'fa-solid fa-rocket', dot: 'bg-emerald-500' }
};

/** `production r12`, the way a revision is said everywhere. */
export const revisionName = (environment: Environment, revision: number): string =>
  environment === 'main' ? 'the draft' : `${ENVIRONMENT_META[environment].label.toLowerCase()} r${String(revision)}`;
