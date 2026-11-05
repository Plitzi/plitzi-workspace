import { isRecord } from '@plitzi/sdk-shared/helpers';

import { RENDER_PATH, RENDER_PROTOCOL } from './protocol';
import { RenderRunFailure } from '../engine/runtime/renderFailure';

import type { RenderAnswer, RenderAsk } from './protocol';
import type { RscElementResolver } from '@plitzi/sdk-kernel/engine';
import type { ActionRunSummary, Element } from '@plitzi/sdk-shared';

export type RemoteRenderOptions = {
  /** Where the worker listens, as this page server reaches it — `http://worker:8892`. Never the browser's address. */
  url: string;
  /** The worker's `render.secret`. */
  secret: string;
};

/** The element and every element under it, by `definition.items`: what a connector's projection reads. */
const subtreeOf = (flat: Record<string, Element>, rootId: string): Record<string, Element> => {
  const subtree: Record<string, Element> = {};
  const pending = [rootId];
  while (pending.length > 0) {
    const id = pending.pop();
    const element = id === undefined ? undefined : (flat[id] as Element | undefined);
    if (id === undefined || !element || id in subtree) {
      continue;
    }

    subtree[id] = element;
    pending.push(...(element.definition.items ?? []));
  }

  return subtree;
};

const isAnswer = (value: unknown): value is RenderAnswer =>
  isRecord(value) && typeof value.ok === 'boolean' && Array.isArray(value.runs);

/**
 * A page's server elements resolved on a worker (RFC 0032, §4.3): each one asked at `/_render`, so this page server runs
 * no action and no connector, and imports nothing of the engine to run. Handed to it with `engineOnWorker({ render })`.
 *
 * What fed the element comes back with its data — the runs, for a page that debugs — and a failure comes back as one:
 * the element shows its error state, a refusal in the action's own words. A worker that does not answer is that
 * element's failure, said with where it was asked.
 */
export const createRemoteRenderResolver = ({ url, secret }: RemoteRenderOptions): RscElementResolver => {
  const endpoint = `${url.replace(/\/+$/, '')}${RENDER_PATH}`;

  return async ({
    element,
    input,
    flat,
    routeParams,
    queryParams,
    templateData,
    req,
    spaceId,
    environment,
    user,
    signal
  }) => {
    const deployment = req.ctx.spaceDeployment;
    const ask: RenderAsk = {
      protocol: RENDER_PROTOCOL,
      spaceId,
      environment: deployment?.environment ?? environment,
      revision: deployment?.revision ?? 0,
      element,
      subtree: subtreeOf(flat, element.id),
      ...(input === undefined ? {} : { input }),
      routeParams,
      queryParams,
      ...(req.ctx.rscParams ? { rscParams: req.ctx.rscParams } : {}),
      templateData: { ...templateData, paintedKeys: [...templateData.paintedKeys] },
      ...(user ? { user } : {})
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
        body: JSON.stringify(ask),
        signal
      });
    } catch (error) {
      throw new Error(
        `The worker at ${endpoint} did not answer element ${element.id}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }

    const body: unknown = await response.json().catch(() => undefined);
    if (!isAnswer(body)) {
      const said =
        isRecord(body) && typeof body.error === 'string' ? body.error : `answered ${String(response.status)}`;
      throw new Error(`The worker at ${endpoint} refused element ${element.id}: ${said}`);
    }

    const runs: ActionRunSummary[] = body.runs;
    (req.ctx.actionRuns ??= []).push(...runs);
    if (body.ok) {
      return body.data;
    }

    const summary = runs.at(-1);
    if (!summary) {
      throw new Error(body.error);
    }

    throw new RenderRunFailure(
      body.error,
      summary,
      body.said === undefined ? { refused: body.refused } : { refused: body.refused, said: body.said }
    );
  };
};
