import type { SpaceDeployment } from '@plitzi/sdk-shared';

/**
 * Whether the space has a page server to run its actions and resolve its connectors: a deployment served by SSR — the
 * platform's own (`provider: 'ssr'`, no credential: every `<space>.plitzi.app`) or the space's (an SSR credential).
 *
 * Unknown counts as yes: the deployments arrive a moment after the panels do, and a space that is correctly set up should
 * not flash a warning telling its owner it is broken. A late warning beats a wrong one.
 */
/** What it reads of a deployment: what serves it, and the provider of its credential when it has one. */
type Served = { provider: SpaceDeployment['provider']; credential: { provider: string } | null };

const hasServerRendering = (deployments: readonly Served[] | undefined) =>
  deployments === undefined ||
  deployments.some(deployment => deployment.provider === 'ssr' || deployment.credential?.provider === 'ssr');

export default hasServerRendering;
