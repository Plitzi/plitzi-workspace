import { connect, createServer } from 'node:net';

/** Whether something already answers at `port` — the one test that sees a listener on every address, not just `host`. */
const answers = (port: number, host: string): Promise<boolean> =>
  new Promise(resolve => {
    const socket = connect({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });

/** Whether this process could listen at `port` on `host`. */
const bindable = (port: number, host: string): Promise<boolean> =>
  new Promise(resolve => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, host);
  });

/**
 * The first port from `preferred` up that nothing uses — for a development server, which should start beside
 * whatever else is running rather than refuse to.
 *
 * Free means both that nothing answers there and that this process may listen there: a server bound to every
 * address leaves `127.0.0.1` bindable on some systems, and a page server started beside it would never be reached —
 * the other one would answer, with a `200` that looks like success. A deployment that sets its port does not need
 * this: a fixed port that is taken is an error worth stopping for.
 */
export const freePort = async (preferred: number, host = '127.0.0.1', attempts = 20): Promise<number> => {
  for (let port = preferred; port < preferred + attempts; port += 1) {
    if (!(await answers(port, host)) && (await bindable(port, host))) {
      return port;
    }
  }

  throw new Error(`No free port between ${preferred} and ${preferred + attempts - 1} on ${host}. Set PORT to one.`);
};
