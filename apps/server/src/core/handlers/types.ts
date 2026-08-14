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
  /** Read by the CSRF check, which asks nothing of a safe method. Absent is treated as `GET`. */
  method?: string;
  /** The parsed body, when there is one. The flows read fields off it; how it got parsed is the host's business. */
  body?: unknown;
  /** The account this request proved, once the auth middleware has run. */
  user?: Actor;
  /** The space this request is addressed to, and what its bearer may do with it. */
  grant?: Grant;
}

export interface JsonResponse extends CookieSink {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => unknown;
}

export type RouteHandler = (req: AuthedRequest, res: JsonResponse) => Promise<void>;

/** One flow, ready to serve: where it answers, and what to call when it does. */
export interface HttpRoute {
  method: 'GET' | 'POST';
  /** Relative to wherever the host mounts the set — `/auth`, conventionally. */
  path: string;
  handle: RouteHandler;
}

/** Anything routes can be hung on: a router, an app, or a stand-in in a test — `get` and `post`, nothing else. */
export interface RouterLike {
  get: (path: string, handler: RouteHandler) => unknown;
  post: (path: string, handler: RouteHandler) => unknown;
}
