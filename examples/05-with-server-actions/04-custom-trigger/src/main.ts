import { consoleLogger } from '@plitzi/sdk-server';
import { createActionsModule, createRejectLogger, createRunLogger } from '@plitzi/sdk-server/actions';

import { lookups, settlePayout } from './action';
import { exampleKv } from './kv';

/**
 * A trigger this deployment mounts itself.
 *
 * The four built-in ways in — a page call, a webhook, a schedule, a page render — are the ones Plitzi needed. This
 * is the seam for the one you need and nobody built: a queue consumer, a CLI, a stage on your own server, a
 * message off a broker. There is no registration step and no plugin API to satisfy. You call the runner.
 *
 * What makes that safe is that the runner is where every check lives. It re-runs the whole precheck — the trigger
 * exists and is switched on, the access rule, the input contract, the lineage that catches a loop — so a trigger
 * you add cannot end up with a weaker set of rules than `/_action` applies. A check that lived in the endpoint
 * would be a check your trigger silently skips.
 */
const actions = createActionsModule({
  lookups,
  // Shared, so single-flight, cancellation and replay mean something with more than one replica. See `kv.ts`.
  kv: exampleKv,
  // A run that already happened is answered from its own result for five minutes, when the CALLER named the key —
  // which a queue consumer can, because a message has an id.
  idempotency: { replayTtlMs: 5 * 60 * 1000 },
  onRun: createRunLogger(consoleLogger),
  // The other half: the requests that never became runs. A queue that keeps delivering something the contract
  // refuses is a thing you want to see, and it is invisible without this.
  onReject: createRejectLogger(consoleLogger)
});

type Message = { id: string; payoutId: string; amount: number };

/**
 * The consumer.
 *
 * The three lines worth copying are the guards: `begin` takes the single-flight key (so the same message
 * delivered twice at once runs once), `replay` answers a redelivery that arrives after the first one finished,
 * and `end` releases the key and remembers the answer. A consumer that skipped them would work perfectly until
 * the broker did what brokers do.
 */
const consume = async (message: Message) => {
  const begin = {
    spaceId: 1,
    actionId: settlePayout.id,
    callerId: 'queue',
    input: { payoutId: message.payoutId, amount: message.amount },
    // The message's own id: what makes a redelivery provably the same intent rather than a second one.
    idempotencyKey: message.id,
    ttlMs: 10_000
  };

  const replayed = await actions.guards.replay(begin);
  if (replayed) {
    console.log(`[queue] ${message.id} was already settled — answered from the first run`, replayed.output);

    return;
  }

  const run = await actions.guards.begin(begin);
  let outcome;
  try {
    const result = await actions.runAction({
      entry: settlePayout,
      input: begin.input,
      spaceId: 1,
      // The same caller the guard was claimed under: a run and its idempotency key must agree on who asked.
      callerId: begin.callerId,
      environment: 'main',
      // The trigger STEP this run comes in through. Nothing about a queue names a published revision, so this
      // reads the live document — the same rule a webhook and a schedule follow.
      trigger: 'custom',
      runId: run.runId,
      signal: run.controller.signal
    });

    outcome = result;
    console.log(`[queue] ${message.id} →`, result.output);
  } finally {
    // The ANSWER travels with the release. Without it the key is freed and nothing is remembered, so a
    // redelivery would find no result to be answered from and run the flow again.
    await actions.guards.end(run, outcome);
  }
};

const queue: Message[] = [
  { id: 'msg-1', payoutId: 'p_001', amount: 120 },
  { id: 'msg-2', payoutId: 'p_002', amount: 80 },
  // The same message again, which is what every broker eventually does.
  { id: 'msg-1', payoutId: 'p_001', amount: 120 }
];

for (const message of queue) {
  await consume(message);
}

console.log('\n[example] the redelivery did not run the flow a second time, and the total says so.');
