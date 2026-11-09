import type { SSRRequest } from '../types';
import type { Element, Environment, SSRUser } from '@plitzi/sdk-shared';
import type { ServerTemplateData } from '@plitzi/sdk-shared/schema';

/** Everything an element resolver needs to turn one `runtime: 'server'` element into its data slice. */
export type RscResolveContext = {
  element: Element;
  /**
   * What its input resolves to on the page server: what it was saved with, and its bound input the server reads — the
   * address, the answers of the server providers before it (`serverInputOf`).
   */
  input?: unknown;
  /** The whole element map, so a resolver can inspect the subtree that consumes its data. */
  flat: Record<string, Element>;
  routeParams: Record<string, string | undefined>;
  queryParams: Record<string, string>;
  /** What the page server knows of the visit as a template reads it — the space's variables for this host, `navigation`. */
  templateData: ServerTemplateData;
  req: SSRRequest;
  spaceId: number;
  environment: Environment;
  user: SSRUser | undefined;
  /**
   * Aborted when this element's budget runs out, so a resolver can stop the work nobody is waiting for.
   *
   * The timeout below only ever decided when to STOP WAITING — the losing side of a race keeps running — so a
   * provider that took longer than its budget went on holding a run slot and an outbound connection for a page
   * that had already been sent. What is being cancelled is not the request, it is the work behind it.
   */
  signal: AbortSignal;
};

/** Produces the data slice for a single server element. Returning undefined leaves the element out of the payload. */
export type RscElementResolver = (context: RscResolveContext) => Promise<unknown>;
