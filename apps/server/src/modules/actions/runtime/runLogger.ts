import type { ActionRejectRecord, ActionRunRecord, ServerLogger } from '@plitzi/sdk-shared';

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

/**
 * `onReject`, wired into the same log stream.
 *
 * The refusals are the half a deployment notices it is missing at the worst possible moment: an integration is
 * being set up, every delivery is answered 401, and nothing anywhere says which check refused it. This puts them
 * on the stream the server already reports through, as their own `kind` so a sink can route them somewhere
 * louder than a run.
 *
 * It carries no body, no signature and no header — what went wrong is `reason`, and `detail` is the server's own
 * words about it.
 *
 * Never throws, for the same reason the run logger does not: the caller was refused either way, and a sink's
 * problem must not become the response's.
 */
export const createRejectLogger =
  (logger: ServerLogger) =>
  (record: ActionRejectRecord): void => {
    try {
      logger({
        kind: 'reject',
        name: record.actionId,
        spaceId: record.spaceId,
        environment: record.environment,
        trigger: record.trigger,
        reason: record.reason,
        ...(record.callerId === undefined ? {} : { callerId: record.callerId }),
        // Nothing ran, so there is no duration to report and no reading of this that is a success.
        durationMs: 0,
        ok: false,
        ...(record.detail === undefined ? {} : { error: record.detail }),
        timestamp: new Date().toISOString()
      });
    } catch {
      // A sink that throws is the sink's problem. Reporting it through the same sink is not an option.
    }
  };
