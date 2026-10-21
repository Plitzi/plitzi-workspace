import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { connect, createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';

/** Whether something already answers at `port` — the one test that sees a listener on every address, not just `host`. */
export const portAnswers = (port: number, host: string): Promise<boolean> =>
  new Promise(resolve => {
    const socket = connect({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });

/** Whether this process could listen at `port` on `host`. */
export const portBindable = (port: number, host: string): Promise<boolean> =>
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
    if (!(await portAnswers(port, host)) && (await portBindable(port, host))) {
      return port;
    }
  }

  throw new Error(`No free port between ${preferred} and ${preferred + attempts - 1} on ${host}. Set PORT to one.`);
};

/** How long a port reserved by a server starting is held from the others: past it, the one that reserved it died. */
const RESERVED_MS = 60_000;

/**
 * A free port as {@link freePort} finds it, held from the other servers starting on this machine until `release`: two
 * development servers started at once both found 8080 free and both bound it — one failed (a run's copies, started by
 * their agents together). Each port taken is a file created only if absent (`wx`), in the system's temporary folder;
 * one left by a process that died is taken again once it is older than a minute.
 */
export const reservePort = async (
  preferred: number,
  host = '127.0.0.1',
  attempts = 20
): Promise<{ port: number; release: () => void }> => {
  const folder = path.join(os.tmpdir(), 'plitzi-ports');
  mkdirSync(folder, { recursive: true });
  for (let port = preferred; port < preferred + attempts; port += 1) {
    const file = path.join(folder, `${String(port)}.lock`);
    const left = (() => {
      try {
        return Date.now() - statSync(file).mtimeMs > RESERVED_MS;
      } catch {
        return false;
      }
    })();
    if (left) {
      rmSync(file, { force: true });
    }

    let reserved = false;
    try {
      writeFileSync(file, String(process.pid), { flag: 'wx' });
      reserved = true;
    } catch {
      // Another server starting has it.
    }

    if (reserved) {
      if (!(await portAnswers(port, host)) && (await portBindable(port, host))) {
        return { port, release: () => rmSync(file, { force: true }) };
      }

      rmSync(file, { force: true });
    }
  }

  throw new Error(`No free port between ${preferred} and ${preferred + attempts - 1} on ${host}. Set PORT to one.`);
};
