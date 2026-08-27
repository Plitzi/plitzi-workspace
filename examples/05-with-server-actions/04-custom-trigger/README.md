# A trigger of your own

The four built-in ways into an action — a page call, a webhook, a schedule, a page render — are the ones Plitzi
needed. This is the other extension point: **the way in you need and nobody built**, over the **store you already
run**.

```bash
yarn start
yarn start:dev   # the same, reloading on save, while you edit it
```

```
[Action] settle-payout via custom space=1 completed 1ms ok
[queue] msg-1 → { payoutId: 'p_001', settledTotal: 120 }
[Action] settle-payout via custom space=1 completed 0ms ok
[queue] msg-2 → { payoutId: 'p_002', settledTotal: 200 }
[queue] msg-1 was already settled — answered from the first run { payoutId: 'p_001', settledTotal: 120 }
```

The third message is the second one delivered again, which is what every broker eventually does. It did not run
the flow a second time, and the total says so.

## What matters

**There is no registration step.** You call `runAction`. What makes that safe is that every check lives in the
runner rather than in an endpoint: the trigger step must exist and be switched on, its access rule is applied, the
input contract drops everything it did not declare, and the lineage refuses a run that would close a loop. A
trigger you mount cannot end up with weaker rules than `/_action` applies, because it goes through the same code.

**The `custom` trigger is a step like any other.** It declares who may start a run this way and what they may
send; `name` is what you mount it under. `access: 'public'` on a queue says only that there is no visitor to
authorize — what may put a message on the queue is your business, upstream of this.

**The three lines worth copying are the guards.** `begin` takes the single-flight key, so the same message
delivered twice at once runs once. `replay` answers a redelivery that arrives after the first run finished — the
case single-flight cannot see — and needs the caller to name the key, which a queue message can because it has an
id. `end` releases the key and remembers the answer.

**The store is the seam that degrades in silence.** Without `kv`, the module keeps its own Map: honest for one
process, a no-op for a cluster. Single-flight stops being single, a cancel never reaches the replica running the
flow, and a redelivery runs the work twice. Nothing errors — the symptom is a customer charged twice on a
Tuesday. [`kv.ts`](src/kv.ts) writes the adapter out in full, with the Redis command each of its five operations
maps to.

**`onRun` and `onReject` are separate on purpose.** Runs are history; refusals are a fault report. A queue that
keeps delivering something the contract refuses is a thing you want to see, and it is invisible without the
second one.
