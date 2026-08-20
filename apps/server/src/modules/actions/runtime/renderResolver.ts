import { ActionRunError } from './errors';

import type { RscElementResolver } from '../../rsc/resolveRscData';
import type { ActionsModule } from '../index';
import type { ActionLookups } from '../types';

type ActionElementAttributes = {
  /** Identifier of the action that feeds this element. */
  action?: string;
  /** Extra values handed to the action, on top of the page's route and query params. */
  input?: Record<string, unknown>;
};

/**
 * Resolves a `runtime: 'server'` element that names an ACTION rather than a connector.
 *
 * This is the read a manifest cannot express: two calls that have to be joined, a field computed from both, a
 * shape that depends on who is looking. The element names an action exactly as it would name a connector, and the
 * page still learns nothing about what happens on the other side.
 *
 * Its input is the page's own context — route params, then query params — plus whatever the element declares, so
 * an action feeding `/blog/:slug` reads `{{ input.slug }}` and needs nothing else. The action's own input contract
 * still drops everything it did not declare.
 */
export const createActionResolver =
  (lookups: ActionLookups, module: ActionsModule): RscElementResolver =>
  async ({ element, routeParams, queryParams, spaceId, environment, user, req }) => {
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

    const run = module.guards.begin({
      spaceId,
      actionId: entry.id,
      callerId: user ? `user:${user.id}` : 'render',
      input,
      ttlMs: module.limitsFor(entry.document).timeoutMs
    });

    try {
      const result = await module.runAction({
        entry,
        input: { ...routeParams, ...queryParams, ...input },
        spaceId,
        environment,
        trigger: 'render',
        user,
        runId: run.runId,
        at,
        signal: run.controller.signal
      });

      // The output alone: a render slice is serialized into the page, so anything beyond what the output step
      // named would be published to every visitor of that URL.
      return result.output;
    } catch (error) {
      // A render must not fail because one slice did — `resolveRscData` isolates each element — but the reason
      // belongs in the log, where whoever is debugging an empty section will look.
      if (error instanceof ActionRunError) {
        throw new Error(`Action "${actionId}" refused this render: ${error.reason}`, { cause: error });
      }

      throw error;
    } finally {
      module.guards.end(run);
    }
  };
