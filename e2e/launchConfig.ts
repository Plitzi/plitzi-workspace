/** What the config and `launch.ts` agree on: which servers to start, handed over in the environment, and the port the
 *  launcher answers on once all of them listen. Apart from `launch.ts` because importing that one starts it. */
export const LAUNCH_TARGETS_ENV = 'PLITZI_LAUNCH_TARGETS';

/**
 * The suite's ports, every one of them, in a band of its own: 471xx. The common ones — 3000, 5000, 8080 — are where a
 * developer's own servers already run, and a port somebody else holds stops the run (or, worse, reads as the target
 * being up). The examples keep the last two digits they always had.
 */
const E2E_PORT_BASE = 47100;

const at = (offset: number): number => E2E_PORT_BASE + offset;

export const PORTS = {
  renderOffline: at(1),
  reactComponent: at(2),
  ssrPages: at(3),
  ssrRsc: at(4),
  mcpServer: at(5),
  ssrMcpPreview: at(6),
  withUsers: at(7),
  withUsersMysql: at(8),
  renderNoBuild: at(9),
  actionsNoServer: at(13),
  schedules: at(17),
  runtime: at(18),
  harness: at(20),
  server: at(30),
  authServer: at(31),
  actionServer: at(32),
  mailSinkHttp: at(33),
  mailSinkSmtp: at(34),
  published: at(35),
  publishedDevtools: at(36),
  workers: at(37),
  plugin: at(38),
  fromSpace: at(39),
  flags: at(40),
  flagsNoDebug: at(41),
  builder: at(80),
  launcher: at(99)
} as const;

export const LAUNCHER_PORT = PORTS.launcher;

/**
 * The suite's own builder. A live run's space token is bound to the origins it was minted for, so this one is among
 * those `yarn token` in plitzi-sdk-server mints for.
 */
export const BUILDER_ORIGIN = `http://127.0.0.1:${String(PORTS.builder)}`;
