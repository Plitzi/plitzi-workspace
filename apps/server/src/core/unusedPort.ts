import { readFileSync } from 'node:fs';

import { portAnswers, portBindable } from './freePort';

/** The lowest port handed out: above the well-known and the registered ones most local services sit on. */
const LOWEST = 10_000;

/** Below it, as far as a system lets a port be chosen for nobody: Linux's default, and below macOS's and Windows's. */
const EPHEMERAL_DEFAULT = 32_768;

const ATTEMPTS = 50;

/**
 * Where the system starts handing out ports by itself — to every outgoing connection and every `listen(0)`. Linux says
 * where in `/proc`; macOS and Windows start at 49152, above Linux's default.
 */
const ephemeralStart = (): number => {
  try {
    const [low] = readFileSync('/proc/sys/net/ipv4/ip_local_port_range', 'utf-8').trim().split(/\s+/).map(Number);
    if (Number.isInteger(low) && low > LOWEST + ATTEMPTS) {
      return Math.min(low, EPHEMERAL_DEFAULT);
    }
  } catch {
    // Not Linux: its default is below everybody else's.
  }

  return EPHEMERAL_DEFAULT;
};

/**
 * A port nobody holds, for a test to listen on — chosen where the system never hands one out by itself.
 *
 * Not one the system hands out (`listen(0)`): that range is the one every outgoing connection takes its local port
 * from, so between the moment a port is handed out and the moment the test listens on it, a request of a test running
 * beside it — another worker's `fetch`, a database connection — can take it, and the listen fails with `EADDRINUSE` on
 * a run that has nothing wrong with it. Below that range only a port somebody chose explicitly is ever taken, and it is
 * looked at first: one that answers, or that this process may not listen on, is passed over.
 */
export const unusedPort = async (host = '127.0.0.1'): Promise<number> => {
  const span = ephemeralStart() - LOWEST;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const port = LOWEST + Math.floor(Math.random() * span);
    if (!(await portAnswers(port, host)) && (await portBindable(port, host))) {
      return port;
    }
  }

  throw new Error(
    `No free port between ${String(LOWEST)} and ${String(LOWEST + span)} on ${host} after ${String(ATTEMPTS)} tries`
  );
};
