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
/**
 * How this webhook proves who is calling it — assembled from the trigger's own fields, not parsed out of a blob.
 *
 * **Naming the credential is what turns it on.** Everything else has a working default, so there is no state
 * between "unsigned" and "verified" for an author to get stuck in: it was a JSON object with an empty
 * `credential` in it, which the editor offered by default and the validator then refused, so picking the webhook
 * trigger produced an error before anybody had typed anything.
 */
export const triggerVerify = (params: ActionTriggerParams): ActionWebhookVerification | undefined => {
  const credential = params.signatureCredential?.trim();
  if (!credential) {
    return undefined;
  }

  const secretField = params.signatureSecretField?.trim();
  const timestampHeader = params.signatureTimestampHeader?.trim();
  const tolerance = Number.parseFloat(params.signatureToleranceSeconds ?? '');

  return {
    type: 'hmac',
    header: params.signatureHeader?.trim() || 'x-signature',
    // Anything else is read as the default rather than refused: the check must not fall back to "no verification"
    // because of a typo, and `sha256` is what a sender that did not say uses.
    algorithm: params.signatureAlgorithm?.trim() === 'sha1' ? 'sha1' : 'sha256',
    credential,
    ...(secretField ? { secretField } : {}),
    ...(timestampHeader ? { timestampHeader } : {}),
    ...(Number.isFinite(tolerance) && tolerance > 0 ? { toleranceSeconds: Math.round(tolerance) } : {})
  };
};

/**
 * Whether this trigger carries a signature check that USED TO VERIFY something and no longer does.
 *
 * A guard, not a compatibility layer: nothing here interprets the old shape, and the only question it answers is
 * whether ignoring it would fail OPEN. A stored `verify: '{…}'` that named a credential was a protected endpoint;
 * read as "unsigned" it becomes a public one with nothing in the document changing, which is the one degradation
 * that must never happen by omission — so it is refused until somebody moves it across.
 *
 * A leftover blob that named NO credential verified nothing to begin with. It is not a downgrade, it is a field
 * the editor used to offer filled in with a default and never completed — and treating it as an error would be an
 * error about something the editor no longer shows, on a webhook that was always unsigned. That one is simply
 * unsigned, and warned about like any other.
 */
export const triggerHasStaleVerify = (params: ActionTriggerParams): boolean => {
  if (params.signatureCredential?.trim()) {
    return false;
  }

  const parsed = parseJson((params as { verify?: unknown }).verify as string | undefined);

  return isRecord(parsed) && typeof parsed.credential === 'string' && parsed.credential.trim() !== '';
};

/**
 * How long a `render` answer may be reused, in milliseconds.
 *
 * Read through here rather than parsed at the call site so the validator and the runtime agree on what an
 * unparseable value means: nothing, which is the same as not caching — never an accidental eternity.
 */
export const triggerCacheMs = (params: ActionTriggerParams): number => {
  const seconds = Number.parseFloat(params.cacheSeconds ?? '');

  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0;
};
