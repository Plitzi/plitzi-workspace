/**
 * Where each process listens, and where the others reach it — environment, so each can run on a machine of its own.
 * Defaults put all three on this machine.
 */
const HOST = process.env.HOST ?? '127.0.0.1';
const port = (name: string, fallback: number): number => Number(process.env[name] ?? fallback);
const url = (name: string, fallback: number): string =>
  (process.env[`${name}_URL`] ?? `http://127.0.0.1:${String(port(`${name}_PORT`, fallback))}`).replace(/\/+$/, '');

export const addresses = {
  host: HOST,
  /** Where people open the pages: the gateway, or the page server itself when the worker is on another origin. */
  public: { port: port('PORT', 4018), url: url('PUBLIC', 4018) },
  pages: { port: port('PAGES_PORT', 4019), url: url('PAGES', 4019) },
  worker: { port: port('WORKER_PORT', 4020), url: url('WORKER', 4020) }
};

/**
 * The worker on an origin of its own (`--elsewhere`, or `ACTIONS_ORIGIN`): the pages call it there, and no gateway sits
 * in front. Absent, both are behind the gateway on one origin.
 */
export const actionsOrigin: string | undefined =
  process.env.ACTIONS_ORIGIN ?? (process.argv.includes('--elsewhere') ? addresses.worker.url : undefined);

/** The paths of a space's host that are the worker's: what the gateway sends there, and nothing else. */
export const WORKER_PATHS = ['/_action', '/fn'];
