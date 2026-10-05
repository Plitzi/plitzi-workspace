import { createHash, randomUUID } from 'node:crypto';

import { triggerCacheMs } from '@plitzi/sdk-shared/actions';

import { ActionRunError } from './errors';
import { createRenderShare } from './renderShare';
import { findTriggerNode, triggerParams } from './triggers';
import { onAbort } from '../../../helpers/onAbort';

import type { RscElementResolver } from '../../rsc/resolveRscData';
import type { ActionsModule } from '../index';
import type { ActionLookups } from '../types';
import type { ActionRunSummary } from '@plitzi/sdk-shared';

/** What one render run produced: the slice the element publishes, and the account a debugger may be shown. */
type RenderRun = { output: unknown; summary: ActionRunSummary };

/**
 * A render run that resolved nothing, carrying what it did.
 *
 * The slice is withheld all the same — `resolveRscData` reads the rejection as the element's error state — but the
 * steps travel with the error, so a page allowed to debug is still shown where the flow broke.
 */
class RenderRunFailure extends Error {
  readonly summary: ActionRunSummary;

  constructor(message: string, summary: ActionRunSummary, options?: ErrorOptions) {
    super(message, options);
    this.summary = summary;
  }
}

type ActionElementAttributes = {
  /** Identifier of the action that feeds this element. */
  action?: string;
  /** Extra values handed to the action, on top of the page's route and query params. */
  input?: Record<string, unknown>;
};

/**
 * What makes two renders the same question.
 *
 * Everything that can change the answer, and nothing else: the space and the version being served, the action,
 * the visitor, and the input the flow will actually see. The USER is in there because an action may read
 * `{{ user.* }}` — sharing across visitors would hand one person another's page — while anonymous visitors, who
 * are most of them, share the one key that matters.
 */
const shareKey = (parts: unknown[]): string =>
  createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32);

/**
 * Resolves a `runtime: 'server'` element that names an ACTION rather than a connector.
 *
 * This is the read a manifest cannot express: two calls that have to be joined, a field computed from both, a
 * shape that depends on who is looking. The element names an action exactly as it would name a connector, and the
 * page still learns nothing about what happens on the other side.
 *
 * Its input is the page's own context — route params, then query params — plus whatever the element declares, so
 * an action feeding `/blog/:slug` reads `{{ input.slug }}` and needs nothing else; a refresh's own params (what
 * `reloadApi` or a bound `input` asked for) come last and win. The action's own input contract still drops everything
 * it did not declare.
 */
export const createActionResolver = (lookups: ActionLookups, module: ActionsModule): RscElementResolver => {
  // One per server, so every render of every page shares the same in-flight map and the same reuse window.
  const share = createRenderShare();

  return async ({ element, routeParams, queryParams, spaceId, environment, user, req, signal }) => {
    /**
     * Which version of the space is being rendered — environment AND revision from the same record.
     *
     * Reading one from the deployment and the other from the resolve context would let them disagree, and the
     * combination "this environment, that revision" names a snapshot nobody published.
     */
    const deployment = req.ctx.spaceDeployment;
    const at = { environment: deployment?.environment ?? environment, revision: deployment?.revision ?? 0 };
    const { action: actionId, input = {} } = element.attributes as ActionElementAttributes;
    if (!actionId) {
      return undefined;
    }

    // The render's own revision: the element and the action it names were published together.
    const entry = await lookups.getAction(spaceId, actionId, at);
    if (!entry) {
      throw new Error(`Action "${actionId}" is not configured for space ${spaceId}`);
    }

    // What a refresh asked for this time — `reloadApi`'s input, a bound `input` — over what the element was saved with.
    const values = { ...routeParams, ...queryParams, ...input, ...req.ctx.rscParams };
    // How long an answer may be reused is read off the trigger STEP, like everything else about a way in.
    const trigger = findTriggerNode(entry.document.nodes, 'render');
    const ttlMs = trigger ? triggerCacheMs(triggerParams(trigger)) : 0;
    const key = shareKey([spaceId, at.environment, at.revision, entry.id, user?.id ?? null, values]);

    const callerId = user ? `user:${user.id}` : 'render';
    // The run this render started, when it was the one that started it rather than joining another.
    let ownRunId: string | undefined;

    /** `stop` is the shared run's: aborted once nobody is waiting for it, this render included. */
    const startRun = async (stop: AbortSignal): Promise<RenderRun> => {
      /**
       * A key of its own per render, so two visitors are never each other's duplicate.
       *
       * Single-flight exists for the caller who submits twice — a double-click, a retry — and keys on the caller
       * and the input. A render has neither of those to go on: every anonymous visitor of one URL is `render`
       * with the same input, so the derived key made concurrent page loads collide and one of them had its
       * section refused as a duplicate. The busier the page, the more often.
       */
      const run = await module.guards.begin({
        spaceId,
        actionId: entry.id,
        callerId,
        input,
        idempotencyKey: `render:${randomUUID()}`,
        // Counted as traffic rather than as somebody asking for work: a page's popularity must not be refused.
        kind: 'render',
        ttlMs: module.limitsFor(entry.document).timeoutMs
      });
      ownRunId = run.runId;

      /**
       * The renders giving up end the run, not just the wait for it — all of them: a render another visitor joined is
       * that visitor's answer too.
       *
       * `resolveRscData` stops waiting when an element's budget is gone or the browser hung up, and before this the
       * run carried on to its own timeout — holding a slot and an outbound connection for a page already answered.
       */
      const releaseRenderStop = onAbort(stop, () => run.controller.abort());
      const startedAt = Date.now();
      const summaryOf = (outcome: Pick<ActionRunSummary, 'status' | 'steps' | 'error'>): ActionRunSummary => ({
        actionId: entry.id,
        runId: run.runId,
        trigger: 'render',
        startedAt,
        endedAt: Date.now(),
        ...outcome
      });

      try {
        const result = await module.runAction({
          entry,
          input: values,
          spaceId,
          environment,
          trigger: 'render',
          user,
          callerId,
          runId: run.runId,
          at,
          signal: run.controller.signal
        });

        /**
         * A run that did not COMPLETE resolved nothing, and must not look like one that resolved to nothing.
         *
         * A step that throws — an outbound call with no internet behind it, a `flow.fail` guard, a timeout — ends
         * the run with `status: 'failed'` and an empty output, which published as a slice is indistinguishable
         * from a provider that legitimately returned no records. The element then renders its empty state instead
         * of its error one, and the bindings meant for exactly this (`hasError`, `errorMessage`) never fire: the
         * page says "nothing here" when the truth is "this could not be fetched".
         */
        const summary = summaryOf({ status: result.status, steps: result.steps });
        if (result.status !== 'completed') {
          throw new RenderRunFailure(`Action "${actionId}" ended as ${result.status}`, summary);
        }

        // The output alone: a render slice is serialized into the page, so anything beyond what the output step
        // named would be published to every visitor of that URL.
        return { output: result.output, summary };
      } catch (error) {
        if (error instanceof RenderRunFailure) {
          throw error;
        }

        // A render must not fail because one slice did — `resolveRscData` isolates each element — but the reason
        // belongs in the log, where whoever is debugging an empty section will look. A debugger is told the refusal
        // in the server's own words and nothing a provider said.
        if (error instanceof ActionRunError) {
          const status = error.reason === 'aborted' ? 'aborted' : 'failed';
          throw new RenderRunFailure(
            `Action "${actionId}" refused this render: ${error.reason}`,
            summaryOf({ status, steps: error.steps ?? [], error: error.message }),
            { cause: error }
          );
        }

        throw new RenderRunFailure(
          error instanceof Error ? error.message : String(error),
          summaryOf({ status: 'failed', steps: [], error: 'Action failed' }),
          { cause: error }
        );
      } finally {
        releaseRenderStop();
        await module.guards.end(run);
      }
    };

    // Every render that reads the run is told about it, a joined or reused one included: it is what fed this page.
    // Once: a run the page stopped waiting for was told about then, and how it ends afterwards reaches nobody.
    let told = false;
    const record = (summary: ActionRunSummary) => {
      if (!told) {
        told = true;
        (req.ctx.actionRuns ??= []).push({ ...summary, elementId: element.id });
      }
    };

    /**
     * The page stopped waiting — the section's budget ran out — and is answered without it: said NOW, while the page
     * still has the request's runs to send. The run itself ends a moment later, aborted, when the page has gone; told
     * then, a debugger would never hear of the one run it needed to — the slow one.
     */
    const askedAt = Date.now();
    const stopWaiting = onAbort(signal, () => {
      record({
        actionId: entry.id,
        runId: ownRunId ?? `render:${randomUUID()}`,
        trigger: 'render',
        status: 'aborted',
        startedAt: askedAt,
        endedAt: Date.now(),
        steps: [],
        error: 'Still running when the page stopped waiting for it: it took longer than a section is given'
      });
    });

    /**
     * Everyone asking the same question at once gets one run, and its answer.
     *
     * Not an optimisation — it is what makes a page survive being read. Without it, a thousand visitors of one URL
     * are a thousand identical flows and a thousand identical outbound requests, arriving at whatever the action
     * reads all in the same instant.
     */
    try {
      // The share holds whatever it is handed; this resolver is the only thing that ever hands it a `RenderRun`.
      const { output, summary } = (await share.run(key, ttlMs, startRun, signal)) as RenderRun;
      record(summary);

      return output;
    } catch (error) {
      if (error instanceof RenderRunFailure) {
        record(error.summary);
      }

      throw error;
    } finally {
      stopWaiting();
    }
  };
};
