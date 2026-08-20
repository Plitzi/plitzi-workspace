import type { ActionAccess, ActionField, ActionTriggerParams, ActionWebhookVerification } from '../types';

/**
 * Reading a trigger step's params.
 *
 * They are stored flat and stringy so the flow editor can author them with the controls it already has, which
 * leaves exactly one place where that shape is turned back into what the runner wants: here. The validator and the
 * runtime both go through it, so a document the editor accepts cannot mean something else at request time.
 *
 * Everything is tolerant on the way out. A half-typed JSON field map in an editor must not throw where it is read
 * — the validator is what tells the author it is wrong, and it says so with the path.
 */

const parseJson = (raw: string | undefined): unknown => {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return undefined;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Who may start a run this way.
 *
 * `undefined` is a trigger that states no rule, which is refused rather than guessed at — every guess is either a
 * lock-out or a hole. A `schedule` has no caller and states none, and the runner does not ask.
 */
export const triggerAccess = (params: ActionTriggerParams): ActionAccess | undefined => {
  const { access } = params;
  if (access === 'public' || access === 'session') {
    return { mode: access };
  }

  if (access !== 'role') {
    return undefined;
  }

  return {
    mode: 'role',
    permissions: (params.permissions ?? '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  };
};

/** What a caller may send through this way in. An unparseable map reads as no contract at all, which drops every key. */
export const triggerInput = (params: ActionTriggerParams): Record<string, ActionField> => {
  const parsed = parseJson(params.input);

  return isRecord(parsed) ? (parsed as Record<string, ActionField>) : {};
};

/** How an inbound webhook proves itself, or nothing — which is an endpoint anyone who learns the URL can start. */
export const triggerVerify = (params: ActionTriggerParams): ActionWebhookVerification | undefined => {
  const parsed = parseJson(params.verify);

  return isRecord(parsed) ? (parsed as ActionWebhookVerification) : undefined;
};
