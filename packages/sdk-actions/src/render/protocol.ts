import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { ActionRunSummary, Element, Environment, SSRUser } from '@plitzi/sdk-shared';
import type { ServerTemplateData } from '@plitzi/sdk-shared/schema';

/** Where a worker answers a page server's server elements (`render.secret`): never a browser's, never routed to it. */
export const RENDER_PATH = '/_render';

/**
 * The version of what a page server and a worker say to each other at {@link RENDER_PATH}, `major.minor` as the
 * functions protocol's (D14): a minor adds what the other may ignore, a major is refused both ways, naming which side
 * to upgrade — so a rolling deploy says why its sections are empty instead of rendering them wrong.
 */
export const RENDER_PROTOCOL = '1.0';

/**
 * One server element, as the page server asks the worker for its data: the element and the subtree that reads it, what
 * its input resolved to, the visit as a template reads it, the space and version being rendered, and who is looking —
 * already resolved by the page server, which the worker trusts through the secret.
 */
export type RenderAsk = {
  protocol: string;
  spaceId: number;
  environment: Environment;
  revision: number;
  element: Element;
  /** The element and every element under it: what a connector's projection reads to send only the bound fields. */
  subtree: Record<string, Element>;
  input?: unknown;
  routeParams: Record<string, string | undefined>;
  queryParams: Record<string, string>;
  /** What a refresh asked for beside the page's address (`/_rsc?…`). */
  rscParams?: Record<string, string>;
  templateData: Omit<ServerTemplateData, 'paintedKeys'> & { paintedKeys: string[] };
  user?: SSRUser;
};

/** The worker's answer: the element's data, or why there is none — and the runs that fed it, for a page that debugs. */
export type RenderAnswer =
  | { ok: true; data: unknown; runs: ActionRunSummary[] }
  | { ok: false; error: string; refused: boolean; said?: string; runs: ActionRunSummary[] };

const ENVIRONMENTS: readonly Environment[] = ['production', 'staging', 'development', 'main'];

/** A body read as an ask, or what is wrong with it — said to the page server, which wrote it. */
export const readRenderAsk = (body: unknown): RenderAsk | string => {
  if (!isRecord(body)) {
    return 'A render ask is a JSON object';
  }

  const { spaceId, environment, revision, element, subtree, routeParams, queryParams, templateData } = body;
  if (typeof spaceId !== 'number' || typeof revision !== 'number') {
    return 'A render ask names its `spaceId` and `revision`, as numbers';
  }

  if (typeof environment !== 'string' || !ENVIRONMENTS.some(each => each === environment)) {
    return `A render ask names its \`environment\`: one of ${ENVIRONMENTS.join(', ')}`;
  }

  if (!isRecord(element) || typeof element.id !== 'string' || !isRecord(subtree)) {
    return 'A render ask carries its `element` and the `subtree` under it';
  }

  if (!isRecord(routeParams) || !isRecord(queryParams) || !isRecord(templateData)) {
    return 'A render ask carries the visit: `routeParams`, `queryParams` and `templateData`';
  }

  // Checked as far as what reads it needs: the page server that wrote it is trusted through the secret.
  return body as RenderAsk;
};
