import { PLUGIN_ROUTES_SEGMENT } from '@plitzi/sdk-shared/actions';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import { pluginTaskProblem } from './scope';
import { taskName, taskNameProblem } from '../actions/tasks/registry';

import type { FunctionLimits } from './protocol';
import type { FunctionScope } from './scope';
import type {
  FunctionOAuthConnection,
  FunctionsManifest,
  FunctionTaskManifest,
  FunctionTimeLimits
} from '@plitzi/sdk-shared';

type TaskParam = FunctionTaskManifest['params'][string];

export const ROUTE_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export type RouteMethod = (typeof ROUTE_METHODS)[number];

export type RouteKey = { method: RouteMethod; segments: string[] };

const SEGMENT = /^(:[a-zA-Z][a-zA-Z0-9]*|[A-Za-z0-9._~-]+)$/;

const isRouteMethod = (method: string): method is RouteMethod => ROUTE_METHODS.some(known => known === method);

/** Why a space's (or a deployment's) route is refused: `/fn/plugins/` is where plugins answer. */
export const reservedRouteProblem = (route: string): string =>
  `Route "${route}" is under /plugins/, where the plugins' routes answer (/fn/plugins/<type>/…)`;

/**
 * A route key, `'<METHOD> /<path>'`: literal segments and `:params`, served under `/fn/`. Anything else — a query, a
 * wildcard, `..` — is not a key, so what a space may answer is only ever a path it spelled out.
 */
export const parseRouteKey = (key: string): RouteKey | undefined => {
  const [method = '', path = '', ...rest] = key.trim().split(/\s+/);
  if (rest.length || !isRouteMethod(method) || !path.startsWith('/')) {
    return undefined;
  }

  const segments = path.slice(1).split('/');
  if (!segments.every(segment => SEGMENT.test(segment) && segment !== '.' && segment !== '..')) {
    return undefined;
  }

  return { method, segments };
};

const HOST = /^(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

/** Where the platform answers the visitor back from an OAuth provider: no route of a space's may be it. */
const OAUTH_CALLBACK_SEGMENTS = ['oauth', 'callback'];

const CONNECTION_NAME = /^[A-Za-z][A-Za-z0-9-]{0,63}$/;

/** What the platform writes into the consent URL itself: `authorizeParams` may add to it, never change it. */
const OWN_AUTHORIZE_PARAMS = new Set([
  'response_type',
  'client_id',
  'redirect_uri',
  'state',
  'code_challenge',
  'code_challenge_method',
  'scope'
]);

const httpsUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    return new URL(value).protocol === 'https:' ? value : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The OAuth connections a definition declared, rebuilt field by field: each a provider's issuer or its endpoints (https),
 * the credential with the app's id and secret, the scopes. What is wrong is said by connection, and that one left out.
 */
const oauthOf = (
  value: unknown,
  problems: string[],
  scope?: FunctionScope
): Record<string, FunctionOAuthConnection> | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (scope) {
    problems.push('The functions of a plugin declare no OAuth connections: only its space does (oauth)');

    return undefined;
  }

  if (!isRecord(value)) {
    problems.push('oauth is an object of connections, by the name the code calls them');

    return undefined;
  }

  const connections: Record<string, FunctionOAuthConnection> = {};
  for (const [name, entry] of Object.entries(value)) {
    const where = `OAuth connection "${name}"`;
    const said = problems.length;
    if (!CONNECTION_NAME.test(name)) {
      problems.push(`${where}: a name is a letter, then letters, digits and "-", up to 64`);
    }

    const spec = isRecord(entry) ? entry : {};
    const credential = stringOf(spec.credential);
    if (!credential) {
      problems.push(`${where} names no credential: the space's credential with the app's clientId and clientSecret`);
    }

    const urls: Partial<Record<'issuer' | 'authorizeUrl' | 'tokenUrl' | 'revokeUrl', string>> = {};
    for (const field of ['issuer', 'authorizeUrl', 'tokenUrl', 'revokeUrl'] as const) {
      if (spec[field] === undefined) {
        continue;
      }

      const url = httpsUrl(spec[field]);
      if (url) {
        urls[field] = url;
      } else {
        problems.push(`${where}: ${field} is an https URL`);
      }
    }

    if (!urls.issuer && !(urls.authorizeUrl && urls.tokenUrl)) {
      problems.push(`${where}: an issuer (OpenID), or its authorizeUrl and tokenUrl`);
    }

    const scopes = Array.isArray(spec.scopes) ? spec.scopes : [];
    if (spec.scopes !== undefined && (!Array.isArray(spec.scopes) || !scopes.every(each => typeof each === 'string'))) {
      problems.push(`${where}: scopes are strings`);
    }

    const params = isRecord(spec.authorizeParams) ? spec.authorizeParams : {};
    if (spec.authorizeParams !== undefined && !isRecord(spec.authorizeParams)) {
      problems.push(`${where}: authorizeParams is an object of strings`);
    }

    const authorizeParams: Record<string, string> = {};
    for (const [key, param] of Object.entries(params)) {
      if (OWN_AUTHORIZE_PARAMS.has(key)) {
        problems.push(`${where}: authorizeParams.${key} is the platform's to write`);
      } else if (typeof param === 'string') {
        authorizeParams[key] = param;
      } else {
        problems.push(`${where}: authorizeParams.${key} is a string`);
      }
    }

    if (spec.clientAuth !== undefined && spec.clientAuth !== 'body' && spec.clientAuth !== 'basic') {
      problems.push(`${where}: clientAuth is "body" or "basic"`);
    }

    if (problems.length > said || !credential) {
      continue;
    }

    connections[name] = {
      ...urls,
      credential,
      ...(scopes.length ? { scopes: scopes.filter((each): each is string => typeof each === 'string') } : {}),
      ...(Object.keys(authorizeParams).length ? { authorizeParams } : {}),
      ...(spec.clientAuth === 'basic' || spec.clientAuth === 'body' ? { clientAuth: spec.clientAuth } : {})
    };
  }

  return Object.keys(connections).length ? connections : undefined;
};

const stringOf = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

const optionsOf = (value: unknown): { label: string; value: string }[] | undefined =>
  Array.isArray(value)
    ? value.flatMap(option => {
        const label = isRecord(option) ? stringOf(option.label) : undefined;
        const optionValue = isRecord(option) ? stringOf(option.value) : undefined;

        return label !== undefined && optionValue !== undefined ? [{ label, value: optionValue }] : [];
      })
    : undefined;

/**
 * One param, rebuilt from what the bundle said rather than trusted: only the serializable shapes a step editor draws.
 * A computed `type`, `when` or `options` is code, and a bundle's code runs in the sandbox, never in the builder.
 */
const paramOf = (value: unknown): TaskParam | string => {
  if (!isRecord(value)) {
    return 'is not an object';
  }

  const base = {
    ...(typeof value.canBind === 'boolean' ? { canBind: value.canBind } : {}),
    ...(typeof value.label === 'string' ? { label: value.label } : {}),
    ...(typeof value.when === 'boolean' ? { when: value.when } : {}),
    ...(typeof value.required === 'boolean' ? { required: value.required } : {})
  };
  const bound = (key: 'maxLength' | 'min' | 'max') =>
    typeof value[key] === 'number' && Number.isFinite(value[key]) ? { [key]: value[key] } : {};
  const defaultValue = value.defaultValue;
  switch (value.type) {
    case 'text':
    case 'textarea':
      return {
        ...base,
        type: value.type,
        ...(typeof defaultValue === 'string' || typeof defaultValue === 'number' ? { defaultValue } : {}),
        ...bound('maxLength')
      };
    // Drawn as text, and handed to the task as a number (`withDefaults`), as a callback's `number` is in the browser.
    case 'number':
      return {
        ...base,
        type: 'number',
        ...(typeof defaultValue === 'number' ? { defaultValue } : {}),
        ...bound('min'),
        ...bound('max')
      };
    case 'codemirror-text':
    case 'codemirror-json':
      return { ...base, type: value.type, ...(typeof defaultValue === 'string' ? { defaultValue } : {}) };
    case 'boolean':
      return { ...base, type: 'boolean', ...(typeof defaultValue === 'boolean' ? { defaultValue } : {}) };
    case 'elements':
      return {
        ...base,
        type: 'elements',
        ...(Array.isArray(defaultValue) ? { defaultValue: defaultValue.filter(id => typeof id === 'string') } : {}),
        ...(typeof value.elementType === 'string' ? { elementType: value.elementType } : {})
      };
    case 'select': {
      const options = optionsOf(value.options);
      if (!options?.length) {
        return 'is a select with no options';
      }

      return { ...base, type: 'select', options, ...(typeof defaultValue === 'string' ? { defaultValue } : {}) };
    }
    default:
      return `has a type the builder cannot draw ("${String(value.type)}"): text, number, textarea, codemirror-text, codemirror-json, boolean, elements or select`;
  }
};

export type ManifestReading = { manifest: FunctionsManifest; problems: string[] };

/** What each asked limit is, in words a problem is written in. */
const LIMIT_WORDS: Record<keyof FunctionTimeLimits, string> = { cpuMs: 'of CPU', wallMs: 'to finish' };

/**
 * What `where` asks for beyond the default, read: whole milliseconds above nothing — and never more than `ceilings`, which
 * is said rather than quietly cut down, so the author knows what the code will get.
 */
const limitsOf = (
  value: unknown,
  where: string,
  ceilings: FunctionLimits,
  problems: string[]
): FunctionTimeLimits | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    problems.push(`${where}: limits is not an object like { cpuMs: 1000, wallMs: 20000 }`);

    return undefined;
  }

  const limits: FunctionTimeLimits = {};
  (['cpuMs', 'wallMs'] as const).forEach(key => {
    const asked = value[key];
    if (asked === undefined) {
      return;
    }

    if (typeof asked !== 'number' || !Number.isInteger(asked) || asked <= 0) {
      problems.push(`${where}: limits.${key} is not a whole number of milliseconds above 0`);
    } else if (asked > ceilings[key]) {
      problems.push(
        `${where}: asks for ${String(asked)} ms ${LIMIT_WORDS[key]}, and this server allows at most ${String(ceilings[key])} ms`
      );
    } else {
      limits[key] = asked;
    }
  });
  Object.keys(value)
    .filter(key => key !== 'cpuMs' && key !== 'wallMs')
    .forEach(key => problems.push(`${where}: limits.${key} is not a limit a function asks for (cpuMs, wallMs)`));

  return Object.keys(limits).length ? limits : undefined;
};

/**
 * Reads what a bundle said it declares, and every rule it must meet — the one validator, at save and nowhere else
 * afterwards, because what is stored is only ever what passed it.
 *
 * `reserved` is every namespace this deployment's own tasks use: a space's task may take none of them, so a step that
 * names a platform task always runs the platform's. `ceilings` is the most this deployment gives one invocation: what a
 * task may ask for.
 */
export const readManifest = (
  value: unknown,
  reserved: ReadonlySet<string>,
  ceilings: FunctionLimits,
  scope?: FunctionScope
): ManifestReading => {
  const problems: string[] = [];
  const raw = isRecord(value) ? value : {};

  const hosts = Array.isArray(raw.hosts) ? raw.hosts.filter(host => typeof host === 'string') : [];
  hosts
    .filter(host => !HOST.test(host))
    .forEach(host => {
      problems.push(`allow.hosts: "${host}" is not a hostname (a name like api.example.com, or *.example.com)`);
    });

  const tasks: FunctionTaskManifest[] = [];
  const names = new Set<string>();
  (Array.isArray(raw.tasks) ? raw.tasks : []).forEach((entry: unknown, index) => {
    const task = isRecord(entry) ? entry : {};
    const namespace = stringOf(task.namespace) ?? '';
    const action = stringOf(task.action) ?? '';
    const title = stringOf(task.title) ?? '';
    const where = namespace && action ? `Task "${namespace}.${action}"` : `tasks[${String(index)}]`;
    const nameProblem = taskNameProblem({ namespace, action }, reserved);
    if (nameProblem) {
      problems.push(nameProblem);

      return;
    }

    if (scope && namespace !== scope.plugin) {
      problems.push(pluginTaskProblem(scope.plugin, namespace, action));

      return;
    }

    const name = taskName({ namespace, action });
    if (names.has(name)) {
      problems.push(`${where} is declared twice`);

      return;
    }

    names.add(name);
    if (!title) {
      problems.push(`${where} has no title`);
    }

    const params: Record<string, TaskParam> = {};
    Object.entries(isRecord(task.params) ? task.params : {}).forEach(([key, param]) => {
      const read = paramOf(param);
      if (typeof read === 'string') {
        problems.push(`${where}: param "${key}" ${read}`);
      } else {
        params[key] = read;
      }
    });

    const description = stringOf(task.description);
    const limits = limitsOf(task.limits, where, ceilings, problems);
    tasks.push({
      namespace,
      action,
      title,
      ...(description ? { description } : {}),
      params,
      ...(limits ? { limits } : {})
    });
  });

  const routes = Array.isArray(raw.routes) ? raw.routes.filter(route => typeof route === 'string') : [];
  const routed = new Set<string>();
  routes.forEach(route => {
    const key = parseRouteKey(route);
    if (!key) {
      problems.push(`Route "${route}" is not "<GET|POST|PUT|PATCH|DELETE> /<path>" of literal segments and :params`);

      return;
    }

    if (!scope && key.segments[0] === PLUGIN_ROUTES_SEGMENT) {
      problems.push(reservedRouteProblem(route));

      return;
    }

    if (key.segments.join('/') === OAUTH_CALLBACK_SEGMENTS.join('/')) {
      problems.push(
        `Route "${route}" is /oauth/callback, where the platform answers the visitor back from an OAuth provider`
      );

      return;
    }

    // `/a/:x` and `/a/:y` answer the same requests, so they are the same route whatever the params are called.
    const shape = `${key.method} /${key.segments.map(segment => (segment.startsWith(':') ? ':' : segment)).join('/')}`;
    if (routed.has(shape)) {
      problems.push(`Route "${route}" answers the same requests as another one`);
    }

    routed.add(shape);
  });

  const limits = limitsOf(raw.limits, 'The functions', ceilings, problems);
  const oauth = oauthOf(raw.oauth, problems, scope);

  return {
    manifest: { hosts, tasks, routes, ...(limits ? { limits } : {}), ...(oauth ? { oauth } : {}) },
    problems
  };
};
