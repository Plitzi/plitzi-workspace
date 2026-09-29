import type {
  FunctionAnswer,
  FunctionInvocation,
  FunctionLimits,
  FunctionsBundle,
  FunctionFailureReason,
  FunctionUsage,
  RunnerRequestMessage,
  RunnerResponseMessage
} from '../protocol';
import type { Environment } from '@plitzi/sdk-shared';

const ENVIRONMENTS: Record<Environment, true> = { production: true, staging: true, development: true, main: true };

const isEnvironment = (value: unknown): value is Environment =>
  typeof value === 'string' && Object.hasOwn(ENVIRONMENTS, value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parse = (data: string): Record<string, unknown> | undefined => {
  try {
    const value: unknown = JSON.parse(data);

    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

const bundleOf = (value: unknown): FunctionsBundle | undefined =>
  isRecord(value) && typeof value.id === 'string' && typeof value.code === 'string'
    ? { id: value.id, code: value.code }
    : undefined;

const limitOf = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

const limitsOf = (value: unknown): FunctionLimits | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const cpuMs = limitOf(value.cpuMs);
  const wallMs = limitOf(value.wallMs);
  const memoryMb = limitOf(value.memoryMb);
  const outputBytes = limitOf(value.outputBytes);
  const calls = limitOf(value.calls);

  return cpuMs !== undefined &&
    wallMs !== undefined &&
    memoryMb !== undefined &&
    outputBytes !== undefined &&
    calls !== undefined
    ? { cpuMs, wallMs, memoryMb, outputBytes, calls }
    : undefined;
};

/**
 * An invocation as the platform sent it. The runner only carries it into the isolate, where the guest reads it again;
 * what is checked here is what the runner itself acts on.
 */
const invocationOf = (value: unknown): FunctionInvocation | undefined => {
  if (!isRecord(value) || !isRecord(value.context) || (value.kind !== 'task' && value.kind !== 'route')) {
    return undefined;
  }

  const { context } = value;
  if (
    typeof context.spaceId !== 'number' ||
    typeof context.runId !== 'string' ||
    typeof context.trigger !== 'string' ||
    typeof context.callerId !== 'string' ||
    !isEnvironment(context.environment)
  ) {
    return undefined;
  }

  const facts = {
    spaceId: context.spaceId,
    environment: context.environment,
    runId: context.runId,
    trigger: context.trigger,
    callerId: context.callerId
  };
  const user = isRecord(context.user) ? context.user : undefined;
  const withUser =
    user &&
    typeof user.id === 'number' &&
    typeof user.username === 'string' &&
    typeof user.email === 'string' &&
    typeof user.verified === 'boolean' &&
    Array.isArray(user.permissions) &&
    Array.isArray(user.roles)
      ? {
          ...facts,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            verified: user.verified,
            permissions: user.permissions.filter(entry => typeof entry === 'string'),
            roles: user.roles.filter(entry => typeof entry === 'string')
          }
        }
      : facts;

  if (value.kind === 'task') {
    return typeof value.name === 'string' && isRecord(value.params)
      ? { kind: 'task', name: value.name, params: value.params, context: withUser }
      : undefined;
  }

  const request = isRecord(value.request) ? value.request : undefined;
  if (
    !request ||
    typeof value.key !== 'string' ||
    typeof request.method !== 'string' ||
    typeof request.url !== 'string'
  ) {
    return undefined;
  }

  const params = isRecord(value.params) ? value.params : {};
  const body = isRecord(request.body) ? request.body : undefined;

  return {
    kind: 'route',
    key: value.key,
    params: Object.fromEntries(Object.entries(params).map(([name, param]) => [name, String(param)])),
    request: {
      method: request.method,
      url: request.url,
      headers: Array.isArray(request.headers)
        ? request.headers.flatMap((pair: unknown) =>
            Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'string'
              ? [[pair[0], pair[1]] satisfies [string, string]]
              : []
          )
        : [],
      body:
        body && typeof body.text === 'string'
          ? { text: body.text }
          : body && typeof body.base64 === 'string'
            ? { base64: body.base64 }
            : null
    },
    context: withUser
  };
};

const answerOf = (value: unknown): FunctionAnswer | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  if (value.ok === true) {
    return { ok: true, value: value.value };
  }

  return value.ok === false && typeof value.error === 'string' ? { ok: false, error: value.error } : undefined;
};

/** What the platform sent the runner, or nothing when it is not one of the protocol's messages. */
export const readRequestMessage = (data: string): RunnerRequestMessage | undefined => {
  const message = parse(data);
  switch (message?.type) {
    case 'describe': {
      const bundle = bundleOf(message.bundle);

      return bundle && typeof message.protocol === 'number'
        ? { type: 'describe', protocol: message.protocol, bundle }
        : undefined;
    }
    case 'invoke': {
      const invocation = invocationOf(message.invocation);
      const limits = limitsOf(message.limits);

      return invocation && limits && typeof message.bundleId === 'string' && typeof message.protocol === 'number'
        ? { type: 'invoke', protocol: message.protocol, bundleId: message.bundleId, invocation, limits }
        : undefined;
    }
    case 'bundle': {
      const bundle = bundleOf(message.bundle);

      return bundle ? { type: 'bundle', bundle } : undefined;
    }
    case 'answer': {
      const answer = answerOf(message.answer);

      return answer && typeof message.id === 'number' ? { type: 'answer', id: message.id, answer } : undefined;
    }
    case 'abort':
      return { type: 'abort' };
    default:
      return undefined;
  }
};

const FAILURE_REASONS: readonly FunctionFailureReason[] = [
  'cpu',
  'wall',
  'memory',
  'output',
  'calls',
  'aborted',
  'error',
  'refused'
];

const reasonOf = (value: unknown): FunctionFailureReason => FAILURE_REASONS.find(reason => reason === value) ?? 'error';

const usageOf = (value: unknown): { usage: FunctionUsage } | Record<string, never> => {
  if (!isRecord(value)) {
    return {};
  }

  const cpuMs = limitOf(value.cpuMs);
  const wallMs = limitOf(value.wallMs);
  const calls = limitOf(value.calls);

  return cpuMs !== undefined && wallMs !== undefined && calls !== undefined ? { usage: { cpuMs, wallMs, calls } } : {};
};

/** What the runner sent the platform, or nothing when it is not one of the protocol's messages. */
export const readResponseMessage = (data: string): RunnerResponseMessage | undefined => {
  const message = parse(data);
  switch (message?.type) {
    case 'needBundle':
      return { type: 'needBundle' };
    case 'call':
      return typeof message.id === 'number' ? { type: 'call', id: message.id, call: message.call } : undefined;
    case 'done':
      return { type: 'done', value: message.value, ...usageOf(message.usage) };
    case 'failed':
      return typeof message.error === 'string'
        ? { type: 'failed', reason: reasonOf(message.reason), error: message.error, ...usageOf(message.usage) }
        : undefined;
    default:
      return undefined;
  }
};
