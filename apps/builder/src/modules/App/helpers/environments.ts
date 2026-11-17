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

/**
 * `version 12`, the way a revision is said everywhere: production's is the version a person means, so only another
 * environment's is named (`staging version 3`) — revisions are counted per environment.
 */
export const revisionName = (environment: Environment, revision: number): string =>
  environment === 'main'
    ? 'the draft'
    : environment === 'production'
      ? `version ${String(revision)}`
      : `${ENVIRONMENT_META[environment].label.toLowerCase()} version ${String(revision)}`;

/** The same, to start a sentence or a title: `Version 12`, `Staging version 3`. */
export const revisionTitle = (environment: Environment, revision: number): string => {
  const name = revisionName(environment, revision);

  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
};
