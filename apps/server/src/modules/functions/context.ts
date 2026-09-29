import { processTwigParam } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { fetchOutbound } from '../../helpers/outboundGuard';
import { countRate } from '../actions/runtime/rateLimit';

import type { FunctionContext, FunctionFetch, FunctionUser } from './contract';
import type { ActionTaskContext } from '../actions/types';
import type { SSRUser } from '@plitzi/sdk-shared';

/**
 * Whether `hostname` is one the space declared: exactly, or under a `*.` wildcard (`*.example.com` is every subdomain of
 * it, and not `example.com` itself).
 */
export const hostAllowed = (hostname: string, hosts: readonly string[]): boolean => {
  const host = hostname.toLowerCase();

  return hosts.some(entry => {
    const allowed = entry.toLowerCase();

    return allowed.startsWith('*.') ? host.endsWith(allowed.slice(1)) : host === allowed;
  });
};

const userOf = ({ id, username, email, verified, permissions, roles }: SSRUser): FunctionUser => ({
  id,
  username,
  email,
  verified,
  permissions,
  roles
});

/**
 * A function's `fetch`: only to the hosts the space declared, through the platform's outbound guard (the same rule and
 * the same run budget `http.request` goes through), and — naming a credential — with its values written in where the
 * request says `{{credential.<key>}}`. The value is resolved here and never handed to the code.
 */
const functionFetch =
  (ctx: ActionTaskContext, hosts: readonly string[]): FunctionFetch =>
  async (input, init = {}) => {
    const credential = init.credential ? await ctx.credential(init.credential) : undefined;
    if (init.credential && !credential) {
      throw new Error(`Credential "${init.credential}" is not available for this space`);
    }

    const render = (value: string): string => (credential ? String(processTwigParam(value, { credential })) : value);
    let url: URL;
    try {
      url = new URL(render(typeof input === 'string' ? input : input.href));
    } catch {
      throw new Error('A function fetches an absolute URL');
    }

    if (!hostAllowed(url.hostname, hosts)) {
      throw new Error(`"${url.hostname}" is not among the hosts this space's functions may reach (allow.hosts)`);
    }

    const headers = Object.fromEntries(
      Object.entries(init.headers ?? {}).map(([name, value]) => [name, render(value)])
    );

    return fetchOutbound(ctx.fetch, url, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : render(init.body),
      signal: ctx.signal
    });
  };

/**
 * How the values a function logs read as one line — the one formatting of it, for native functions and for the
 * sandbox's, whose guest only makes each value safe to send.
 */
export const lineOf = (values: readonly unknown[]): string =>
  values
    .map(value => {
      if (typeof value === 'string') {
        return value;
      }

      if (value instanceof Error) {
        return `${value.name}: ${value.message}`;
      }

      if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
        return typeof value;
      }

      try {
        return JSON.stringify(value);
      } catch {
        return Object.prototype.toString.call(value);
      }
    })
    .join(' ');

const unavailable = (what: string) => () => Promise.reject(new Error(`This server has no realtime channels (${what})`));

const unsigned = () => Promise.reject(new Error('This server signs nothing: its actions were given no signingSecret'));

/**
 * What a space's code is handed, built from the run's own context: the one place a {@link FunctionContext} is made.
 * A self-hosted server hands it to the code directly; the platform answers the sandbox's calls with it.
 */
export const functionContextFor = (ctx: ActionTaskContext, hosts: readonly string[]): FunctionContext => ({
  spaceId: ctx.spaceId,
  environment: ctx.environment,
  runId: ctx.runId,
  trigger: ctx.trigger,
  callerId: ctx.callerId,
  ...(ctx.user ? { user: userOf(ctx.user) } : {}),
  kv: ctx.kv,
  rateLimit: (bucket, limit) => countRate(ctx.kv, ctx.callerId, bucket, limit),
  sign: ctx.sign ?? unsigned,
  verify: ctx.verify ?? unsigned,
  fetch: functionFetch(ctx, hosts),
  publish: ctx.publish ?? unavailable('publish'),
  grant: ctx.grant ?? unavailable('grant'),
  revoke: ctx.revoke ?? unavailable('revoke'),
  log: (...values) => ctx.log(lineOf(values)),
  emit: ctx.emit,
  signal: ctx.signal
});
