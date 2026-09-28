import { defineRuntime } from '@plitzi/sdk-server/runtime';

import { AGENT_PATH, createAgentEndpoint } from './agent/hosted.ts';
import { runtimeStoresFrom } from './deployment.ts';
import { createBoardFunctions } from './tasks.ts';

/**
 * Pizarra's own server code — what a platform serving the space cannot be for it: the boards' tasks and pictures, and
 * the agent at `/mcp`, which holds a session and a socket on a board for as long as an agent is there.
 *
 * One module, run two ways. On the platform it is the space's runtime, beside the page server that serves the space:
 * the boards live in the platform's `kv`, their channels are the platform's, and `ctx.sign` signs with the space's key.
 * Self-hosted (`main.ts`), a server of its own loads the same module and is all of those itself.
 *
 * Its variables: `REDIS_URL` keeps the pictures and the agents' whereabouts in a Redis of its own (in memory
 * without it), `REPLICA_URL` names this replica to the others when there are several.
 */
export default defineRuntime({
  start: ({ env, publicUrl }) => {
    const stores = runtimeStoresFrom(env);
    const agents = createAgentEndpoint({ directory: stores.agents, publicUrl });

    return {
      functions: createBoardFunctions({ assets: stores.assets }),
      endpoints: { [AGENT_PATH]: agents.handle },
      close: async () => {
        await agents.close();
        await stores.close();
      }
    };
  }
});
