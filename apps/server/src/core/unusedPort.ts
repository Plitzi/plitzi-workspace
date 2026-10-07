import { createServer } from 'node:net';

/**
 * A port the system has just handed out and nobody holds — what a test listens on. Never a fixed number: one in the
 * system's ephemeral range (above 32768 on Linux) can be taken by any outgoing connection of a test running beside it,
 * and the listen fails with `EADDRINUSE` on a run that has nothing wrong with it.
 */
export const unusedPort = (host = '127.0.0.1'): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, host, () => {
      const address = probe.address();
      probe.close(() => {
        if (typeof address === 'object' && address) {
          resolve(address.port);
        } else {
          reject(new Error(`The system gave no port on ${host}`));
        }
      });
    });
  });
