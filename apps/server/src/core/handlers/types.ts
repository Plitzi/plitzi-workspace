import type { CredentialCarrier } from '../auth/credentials';
import type { Actor, Grant } from '../auth/identity';
import type { CookieSink } from '../auth/session';

/**
 * A request and a response, described by what these handlers actually touch and nothing more.
 *
 * No framework is imported and none is assumed. A bare `node:http` request satisfies `AuthedRequest` once `path`
 * is filled in (`parseRequest` from the kernel does that); an Express, Connect or Koa request satisfies it as it
 * stands. The response needs three things — a status, a JSON body, and a header for the cookies.
 */

export interface AuthedRequest extends CredentialCarrier {
  /** The path alone, without the query string — what the policy matches on. */
  path: string;
  /** The parsed body, when there is one. The flows read fields off it; how it got parsed is the host's business. */
  body?: unknown;
  /** The account this request proved, once the guard has run. */
  user?: Actor;
  /** The space this request is addressed to, and what its bearer may do with it. */
  grant?: Grant;
}

export interface HandlerResponse extends CookieSink {
  status: (code: number) => HandlerResponse;
  json: (body: unknown) => unknown;
}

export type RouteHandler = (req: AuthedRequest, res: HandlerResponse) => Promise<void>;

/** One flow, ready to serve: where it answers, and what to call when it does. */
export interface MountableRoute {
  method: 'GET' | 'POST';
  /** Relative to wherever the host mounts the set — `/auth`, conventionally. */
  path: string;
  handle: RouteHandler;
}

/** Anything routes can be hung on: a router, an app, or a stand-in in a test. */
export interface RouteSink {
  get: (path: string, handler: RouteHandler) => unknown;
  post: (path: string, handler: RouteHandler) => unknown;
}
