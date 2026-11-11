import type { RscElementResolver } from './rsc';
import type { ProjectDataLookup } from '../data/projectData';
import type { FleetStores } from '../http/fleet/link';
import type { BaseContext, Stage } from '../http/types';
import type { RealtimeTransport } from '@plitzi/sdk-shared';

/**
 * What a page server is handed of the actions engine (docs/en/server-packages.md, D11): built by the engine, never by the page server,
 * which mounts it where its pipeline says and reaches it through nothing else. Absent, the server runs no actions, no
 * functions and no realtime, and tells its pages so.
 *
 * The engine's stages read only what every server has (`BaseContext`) and what they close over: the engine's own
 * configuration. So the same stages answer in a page server and in a worker of their own.
 */
export type PageEngine = {
  /**
   * Its endpoints — `/_action` and its webhooks, `/_realtime` — after the auth chain: what a caller may do depends on
   * who is asking.
   */
  endpoints: Stage<BaseContext>[];
  /** `/fn/`: after the deployment's own data stages, so a route of its own under `/api/` stays its own. */
  routes: Stage<BaseContext>[];
  /** Which of its paths switch protocols (a WebSocket). */
  upgrades?: (path: string) => boolean;
  /**
   * Resolves a server element that names an action or a connector, for the page's server-rendered data (§4.3).
   * Answers `undefined` for an element that names neither: the page server reads the rest itself.
   */
  resolveElement?: RscElementResolver;
  /** The space's data as the engine reads it (`action.lookups.getData`): what a `/data/<file>` provider reads too. */
  data?: ProjectDataLookup;
  /** What a page is told: where it calls its actions, and where its realtime channels are. */
  published: { actionPath?: string; realtimePath?: string; realtimeTransport?: RealtimeTransport };
  /** Started once the transport is bound: the jobs, which a server nobody listened on must not be claiming. */
  listening?: () => void;
  /** The server has stopped taking connections: what holds them open for good — realtime sockets — lets them go. */
  closing?: () => void;
  /** Told to stop, before it announces it: it takes no new work from here — a job worker claims nothing more. */
  stopping?: () => void;
  /** Awaited before the sockets close: the jobs running here finish rather than being abandoned. */
  destroy?: () => Promise<void>;
  /** What the primary of a fleet keeps for its workers: each store named by the module that keeps it. */
  fleetStores?: FleetStores;
  /** A plugin's server half, from the plugin's package — refused, naming why, for what is not a definition. */
  setPluginFunctions?: (plugin: string, definition: unknown) => void;
};
