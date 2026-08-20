import type { ActionRunRecord, ServerLogger } from '@plitzi/sdk-shared';

/**
 * `onRun`, wired into the log stream the server already reports through.
 *
 * Without an `onRun` a deployment gets nothing at all about its flows: the request log says a call was answered,
 * and a run started by a webhook or a schedule has no request to say anything about. This is the smallest useful
 * answer to that, and it needs no store — whatever sink is already collecting `ServerLogEvent`s (a console, a
 * file, a log shipper) starts carrying runs too, because a run is emitted as one more event on the same stream.
 *
 * What it reports is the SHAPE of the run — which steps ran and how each ended — and never what they held. A
 * deployment that wants run HISTORY rather than run logs keeps its own `onRun` and writes rows; the two compose,
 * since `onRun` is one function.
 *
 * Never throws: the runner treats the record as best-effort, and a logging outage must not take an action down.
 */
export const createRunLogger =
  (logger: ServerLogger) =>
  (record: ActionRunRecord): void => {
    try {
      logger({
        kind: 'run',
        name: record.actionId,
        spaceId: record.spaceId,
        environment: record.environment,
        trigger: record.trigger,
        status: record.status,
        ...(record.userId === undefined ? {} : { userId: record.userId }),
        steps: record.nodes.map(node => `${node.action}:${node.status}`),
        durationMs: record.durationMs,
        // A run that ended any way other than `completed` is one somebody needs to see, which is what `ok` is for
        // on every other event in this stream — an aborted run is a failure from the caller's side too.
        ok: record.status === 'completed',
        ...(record.error === undefined ? {} : { error: record.error }),
        timestamp: new Date().toISOString()
      });
    } catch {
      // A sink that throws is the sink's problem. Reporting it through the same sink is not an option.
    }
  };
