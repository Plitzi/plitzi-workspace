import { processTwigParam } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { pluginKvPrefix, pluginSigned } from './scope';
import { fetchOutbound } from '../../helpers/outboundGuard';
import { prefixKv } from '../actions/runtime/namespaceKv';
import { countRate } from '../actions/runtime/rateLimit';

import type { FunctionContext, FunctionFetch, FunctionUser } from './contract';
import type { FunctionScope } from './scope';
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
  (ctx: ActionTaskContext, hosts: readonly string[], scope?: FunctionScope): FunctionFetch =>
  async (input, init = {}) => {
    // The space's credentials are the space's: a plugin it uses was trusted to draw, not to spend them.
    if (init.credential && scope) {
      throw new Error(`A plugin's functions name no credential of the space's ("${init.credential}")`);
    }

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

const noJobs = () => Promise.reject(new Error('This server runs no jobs: nothing can be set to run later'));

/**
 * A plugin reads none of its space's data. The space keeps there what its pages must not carry, and a plugin was trusted
 * to draw, not with what the space keeps — the same line as its credentials: handed the data, its `fetch` could send
 * it to any host the plugin declared.
 */
const noData = (file: string) =>
  Promise.reject(new Error(`The functions of a plugin read none of the data of its space ("${file}")`));

/**
 * What a space's code is handed, built from the run's own context: the one place a {@link FunctionContext} is made.
 * A self-hosted server hands it to the code directly; the platform answers the sandbox's calls with it. With a `scope`,
 * it is a plugin's code, and gets the plugin's corner of the space (`./scope`).
 */
export const functionContextFor = (
  ctx: ActionTaskContext,
  hosts: readonly string[],
  scope?: FunctionScope
): FunctionContext => {
  const shared = {
    spaceId: ctx.spaceId,
    environment: ctx.environment,
    runId: ctx.runId,
    trigger: ctx.trigger,
    callerId: ctx.callerId,
    ...(ctx.user ? { user: userOf(ctx.user) } : {}),
    fetch: functionFetch(ctx, hosts, scope),
    log: (...values: unknown[]) => ctx.log(lineOf(values)),
    emit: ctx.emit,
    signal: ctx.signal
  };

  if (!scope) {
    return {
      ...shared,
      kv: ctx.kv,
      rateLimit: (bucket, limit) => countRate(ctx.kv, ctx.callerId, bucket, limit),
      sign: ctx.sign ?? unsigned,
      verify: ctx.verify ?? unsigned,
      publish: ctx.publish ?? unavailable('publish'),
      grant: ctx.grant ?? unavailable('grant'),
      revoke: ctx.revoke ?? unavailable('revoke'),
      later: ctx.later ?? noJobs,
      cancelLater: ctx.cancelLater ?? noJobs,
      data: ctx.data
    };
  }

  // A plugin's corner of the space: its own keys and counters, signatures only it verifies, no channel of the space's and
  // none of its data.
  const kv = prefixKv(ctx.kv, pluginKvPrefix(scope.plugin));
  const { sign, verify } = ctx;
  const noChannel = () =>
    Promise.reject(new Error('The functions of a plugin reach none of the realtime channels of its space'));
  // The space's actions are the space's: a plugin starts none of them, now or later.
  const noLater = () =>
    Promise.reject(new Error('The functions of a plugin set none of the actions of its space to run'));

  return {
    ...shared,
    kv,
    rateLimit: (bucket, limit) => countRate(kv, ctx.callerId, bucket, limit),
    sign: sign ? value => sign(pluginSigned(scope.plugin, value)) : unsigned,
    verify: verify ? (value, signature) => verify(pluginSigned(scope.plugin, value), signature) : unsigned,
    publish: noChannel,
    grant: noChannel,
    revoke: noChannel,
    later: noLater,
    cancelLater: noLater,
    data: noData
  };
};
