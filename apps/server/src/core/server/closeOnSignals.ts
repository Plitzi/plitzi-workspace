import { serverLog } from '../../helpers/serverLog';

/** Anything that closes the way a server from `createServer` does. */
export type Closable = { close: () => Promise<void> };

export type CloseOnSignalsOptions = {
  /** Default `SIGTERM` (what an orchestrator sends before it replaces a replica) and `SIGINT` (^C). */
  signals?: NodeJS.Signals[];
  /** Runs once the server has closed: what the deployment opened itself — a pool, a client, a file — goes here. */
  afterClose?: () => void | Promise<void>;
};

/**
 * Closes the server when the process is told to stop, and only then lets the process exit.
 *
 * `close()` already does the waiting — the page server stops claiming jobs, finishes the ones it is running and lets
 * go of its sockets — but nothing calls it when a deploy sends SIGTERM, and a process that simply exits leaves every
 * running job to be retried by somebody else. This is that call, for a deployment that has no signal handling of its
 * own. Opt in: a host that already manages its process's signals keeps doing so, and calls `close()` from there.
 *
 * ```ts
 * const server = createServer(config);
 * server.listen(3000);
 * closeOnSignals(server, { afterClose: () => pool.end() });
 * ```
 *
 * A second signal while it is closing exits at once — the ^C a person presses when waiting is not what they want.
 * Answers a function that removes the handlers again.
 */
export const closeOnSignals = (
  server: Closable,
  { signals = ['SIGTERM', 'SIGINT'], afterClose }: CloseOnSignalsOptions = {}
): (() => void) => {
  let closing = false;

  const onSignal = (signal: NodeJS.Signals): void => {
    if (closing) {
      serverLog.warn('server', `${signal} again: exiting without waiting`);
      process.exit(1);

      return;
    }

    closing = true;
    serverLog.info('server', `${signal}: finishing what is running, then exiting`);
    void (async () => {
      try {
        await server.close();
        await afterClose?.();
        process.exit(0);
      } catch (error) {
        serverLog.error('server', 'could not close cleanly', error);
        process.exit(1);
      }
    })();
  };

  for (const signal of signals) {
    process.on(signal, onSignal);
  }

  return () => {
    for (const signal of signals) {
      process.off(signal, onSignal);
    }
  };
};
