import { defineRuntime } from '@plitzi/sdk-server/runtime';

import { functions } from './functions.ts';
import { createPulse } from './pulse.ts';

/**
 * A space's runtime: its own server code, as one module (`docs/en/runtimes.md`). The same module runs two ways.
 *
 * - **On the platform**: `plitzi runtime push` packs it, and the platform runs it beside the space it serves — its
 *   tasks for the space's flows, with the space's `kv`, and `/pulse` answered on the space's own host.
 * - **Self-hosted**: a server of your own loads it with `serveRuntime` (`main.ts`), and is all of that itself.
 *
 * `env` is its variables: `PULSE_SECONDS`, how often `/pulse` speaks — set with `plitzi runtime vars set PULSE_SECONDS`
 * on the platform, the server's environment here.
 */
export default defineRuntime({
  start: ({ env }) => {
    const seconds = Number(env.PULSE_SECONDS);
    const pulse = createPulse({ everySeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : 5 });

    return {
      functions,
      endpoints: { '/pulse': pulse.handle },
      close: () => {
        pulse.close();

        return Promise.resolve();
      }
    };
  }
});
