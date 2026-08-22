import { consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';

import { lookups } from './actions';
import { offlineData } from './space';
import { shippingRate } from './tasks';

import type { SSRSpaceDeployment } from '@plitzi/sdk-shared';

const PORT = Number(process.env.PORT ?? 4009);
const DRAFT_PORT = PORT + 1;

const space = offlineData();

/**
 * One page server, wired for actions.
 *
 * `action.lookups` is what turns the endpoint on: with no way to read a document there is nothing to run, and the
 * `/_action` path keeps answering element-addressed connector writes alone. `tasks` is this deployment's own half
 * of the step catalog — the server serves it, so a space can do server-side exactly what this process registered.
 */
const serverFor = (deployment: SSRSpaceDeployment) =>
  createServer({
    devMode: true,
    logger: consoleLogger,
    adapters: createJsonAdapters({ offlineData: space, deployment }),
    action: {
      lookups,
      tasks: [shippingRate],
      /**
       * Every run that STARTED, whatever began it. A run that was REFUSED is not reported: a 409 is not a run,
       * and logging one would bury the real ones under retries.
       */
      onRun: record =>
        console.log(
          `[example] run ${record.actionId} via ${record.trigger} — ${record.status} in ${record.durationMs}ms`
        )
    }
  });

/**
 * Two deployments of one space, so the versioning rule is visible rather than described.
 *
 * They share everything — the same process, the same schema, the same action store — and differ in one field: the
 * revision they are serving. The published one reads the copy publishing left at revision 2; the draft one reads
 * the live document, which is what the builder edits and what a webhook runs.
 *
 * That is the whole rule. A real deployment has these on two hostnames rather than two ports.
 */
const published = serverFor({ spaceId: 1, environment: 'production', revision: 2 });
const draft = serverFor({ spaceId: 1, environment: 'main', revision: 0 });

published.listen(PORT, '127.0.0.1');
draft.listen(DRAFT_PORT, '127.0.0.1');

console.log(`[example] published site (production, revision 2) on http://127.0.0.1:${PORT}/`);
console.log(`[example] the draft      (main, revision 0)       on http://127.0.0.1:${DRAFT_PORT}/`);
console.log(`[example] call it:   curl -s http://127.0.0.1:${PORT}/_action \\`);
console.log("[example]              -H 'content-type: application/json' \\");
console.log('[example]              -d \'{"actionId":"shipping-quote","input":{"city":"Berlin","weightKg":2}}\'');
