import { isKnownTimeZone, parseCron } from './cron';
import { triggerAccess, triggerHasStaleVerify, triggerVerify } from './triggerParams';

import type { ActionTriggerParams } from '../types';

/**
 * The one server-action validator.
 *
 * Three places decide whether a document is fit to store — the builder panel, the MCP write ops and the GraphQL
 * mutation that persists it — and a document is only ever wrong in one way, so the rules live here instead of
 * being restated (and drifting) at each entry point. The input is `unknown` because the server runs it last, on
 * whatever JSON actually arrived: it validates a document, it does not assume one.
 *
 * Errors are what the runner cannot recover from at request time; warnings are what will run but probably does
 * not do what the author meant.
 */

export type ActionDocumentIssue = {
  /** Dotted path into the document, e.g. `nodes.send.action`. */
  path: string;
  message: string;
  hint?: string;
};

export type ActionDocumentReport = {
  valid: boolean;
  errors: ActionDocumentIssue[];
  warnings: ActionDocumentIssue[];
};

const FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'json', 'file'];
const ACCESS_MODES = ['public', 'session', 'role'];
const TRIGGER_TYPES = ['call', 'webhook', 'schedule', 'render', 'custom'];
const SIGNATURE_ALGORITHMS = ['sha256', 'sha1'];
/** What the RUN publishes in the flow scope before any step does — see `runAction`. A step id may not shadow one. */
const RESERVED_SCOPE_KEYS = new Set(['input', 'user', 'spaceId', 'environment', 'trigger', 'runId']);

/** `<namespace>.<action>`, which is how the registry addresses a task. */
const TASK_NAME = /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isFilledString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/** `undefined` means it did not parse, which is different from an empty contract and reported as such. */
const parseMap = (raw: string): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = JSON.parse(raw);

    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const validateFields = (fields: unknown, path: string, errors: ActionDocumentIssue[]) => {
  if (fields === undefined) {
    return;
  }

  if (!isRecord(fields)) {
    errors.push({ path, message: 'must be an object of field definitions' });

    return;
  }

  Object.entries(fields).forEach(([key, field]) => {
    if (!isRecord(field) || !isFilledString(field.type)) {
      errors.push({ path: `${path}.${key}`, message: 'must declare a type' });

      return;
    }

    if (!FIELD_TYPES.includes(field.type)) {
      errors.push({
        path: `${path}.${key}.type`,
        message: `unknown field type "${field.type}"`,
        hint: `one of ${FIELD_TYPES.join(', ')}`
      });
    }
  });
};

/**
 * One way into the action: what starts it, who may, and with what — all in the trigger STEP's own params.
 *
 * They are flat and stringy because the flow editor authors them with the controls it already has, so this is also
 * where a half-written JSON contract is caught: it is read through the same helpers the runner uses, and anything
 * that does not parse is reported here rather than silently meaning "no contract".
 */
const validateTrigger = (
  key: string,
  node: Record<string, unknown>,
  errors: ActionDocumentIssue[],
  warnings: ActionDocumentIssue[]
) => {
  const path = `nodes.${key}`;
  const kind = node.action;
  if (!isFilledString(kind) || !TRIGGER_TYPES.includes(kind)) {
    errors.push({
      path: `${path}.action`,
      message: `"${String(kind)}" is not a way an action can be started`,
      hint: `one of ${TRIGGER_TYPES.join(', ')}`
    });

    return;
  }

  const params = (isRecord(node.params) ? node.params : {}) as ActionTriggerParams;

  if (isFilledString(params.input)) {
    const parsed = parseMap(params.input);
    if (parsed === undefined) {
      errors.push({ path: `${path}.params.input`, message: 'is not valid JSON' });
    } else {
      validateFields(parsed, `${path}.params.input`, errors);
    }
  }

  // A schedule has no caller to authorize: nothing about a clock is a session, and asking for an access rule here
  // would only invite one that means nothing.
  if (kind !== 'schedule') {
    if (!isFilledString(params.access) || !ACCESS_MODES.includes(params.access)) {
      // No default: a way in whose access nobody wrote down would have to be guessed at, and every guess is
      // either a lock-out or a hole.
      errors.push({
        path: `${path}.params.access`,
        message: 'must say who may start a run this way',
        hint: `one of ${ACCESS_MODES.join(', ')}`
      });
    } else if (params.access === 'role') {
      const access = triggerAccess(params);
      // A `role` rule naming nothing lets everybody signed in through, which is the `session` rule wearing a
      // stricter-looking name — the gap somebody finds by reading the flow rather than by being refused.
      if (access?.mode === 'role' && access.permissions.length === 0) {
        errors.push({ path: `${path}.params.permissions`, message: 'role access must name at least one permission' });
      }
    }
  }

  if (kind === 'schedule') {
    if (!isFilledString(params.cron)) {
      errors.push({ path: `${path}.params.cron`, message: 'a scheduled trigger needs a cron expression' });
    } else if (!parseCron(params.cron)) {
      // Checked against the very parser the runner uses. An expression it cannot read does not fail loudly at
      // run time — it simply never matches a minute, and the schedule sits silent for as long as nobody looks.
      errors.push({
        path: `${path}.params.cron`,
        message: `"${params.cron}" is not an expression this server can read, so it would never fire`,
        hint: 'five fields — minute hour day-of-month month day-of-week — with *, lists, ranges and steps'
      });
    }

    // Checked against `Intl`, which is what the runner reads it with. A zone it does not know makes the schedule
    // match no minute at all — the same silent nothing a malformed expression used to produce, and the reason
    // both are caught here instead of in production.
    if (isFilledString(params.timezone) && !isKnownTimeZone(params.timezone)) {
      errors.push({
        path: `${path}.params.timezone`,
        message: `"${params.timezone}" is not a time zone this server knows, so the schedule would never fire`,
        hint: 'an IANA name like America/Santiago or Europe/Madrid — leave it empty for UTC'
      });
    }
  }

  // Only a render may declare one: a call is somebody asking for something to happen, and answering that from a
  // cache is answering a question nobody asked twice.
  if (isFilledString(params.cacheSeconds)) {
    const seconds = Number.parseFloat(params.cacheSeconds);
    if (!Number.isFinite(seconds) || seconds < 0) {
      errors.push({ path: `${path}.params.cacheSeconds`, message: 'must be a number of seconds, or left empty' });
    } else if (kind !== 'render') {
      warnings.push({
        path: `${path}.params.cacheSeconds`,
        message: `a "${kind}" trigger is never answered from a cache`,
        hint: 'reuse only applies to a render, where the same page is built for one visitor after another'
      });
    }
  }

  if (kind === 'custom' && !isFilledString(params.name)) {
    errors.push({ path: `${path}.params.name`, message: 'a custom trigger needs a name to be mounted under' });
  }

  if (kind === 'webhook') {
    // Refused rather than warned about: this endpoint is running unverified right now, and the document says
    // otherwise. Nothing here reads the old shape — moving the credential across is what fixes it.
    if (triggerHasStaleVerify(params)) {
      errors.push({
        path: `${path}.params.signatureCredential`,
        message: 'this signature check is in a format nothing reads any more, so the webhook is unverified',
        hint: 'name the credential holding the signing secret in "Signing secret", and its header beside it'
      });
    }

    const verify = triggerVerify(params);
    // A webhook is reachable by anyone who learns the URL. Without a signature it is an open endpoint into
    // whatever the flow does, so this is called out even though the document is technically runnable.
    if (!verify) {
      warnings.push({
        path: `${path}.params.signatureCredential`,
        message: 'this webhook accepts unsigned requests',
        hint: 'name the credential holding the signing secret, and only the sender you expect can start a run'
      });
    }

    if (isFilledString(params.signatureAlgorithm) && !SIGNATURE_ALGORITHMS.includes(params.signatureAlgorithm)) {
      // Read as `sha256` rather than refused — a check must not fall back to none because of a typo — which is
      // exactly why it is worth saying out loud.
      warnings.push({
        path: `${path}.params.signatureAlgorithm`,
        message: `"${params.signatureAlgorithm}" is not an algorithm this server signs with, so sha256 is used`,
        hint: `one of ${SIGNATURE_ALGORITHMS.join(', ')}`
      });
    }

    if (isFilledString(params.signatureToleranceSeconds) && !isFilledString(params.signatureTimestampHeader)) {
      // A signature over the body alone is valid forever, so there is nothing for an age to be measured against:
      // a captured request replays until the secret rotates, and the tolerance says otherwise.
      warnings.push({
        path: `${path}.params.signatureToleranceSeconds`,
        message: 'a tolerance with no timestamp header expires nothing',
        hint: 'name the header the sender puts the signing time in, or drop the tolerance'
      });
    }
  }

  if (kind === 'call' && params.access === 'public') {
    warnings.push({
      path: `${path}.params.access`,
      message: 'anyone can run this action, including signed-out visitors',
      hint: 'use session access unless the page needs it before anyone signs in'
    });
  }
};

type NodeShape = { id?: unknown; type?: unknown; action?: unknown; afterNode?: unknown; flowId?: unknown };

/**
 * The flows themselves: every one starts at a trigger, and every step can actually run on a server.
 *
 * The last rule is the one worth having a validator for. Client and server flows share a node type, so nothing in
 * the shape stops someone from dropping a `setState` into an action — it just fails at run time, in a place with
 * no browser to set state in.
 */
const validateNodes = (
  nodes: unknown,
  output: unknown,
  errors: ActionDocumentIssue[],
  warnings: ActionDocumentIssue[]
) => {
  if (!isRecord(nodes)) {
    errors.push({ path: 'nodes', message: 'must be an object of steps' });

    return;
  }

  const entries = Object.entries(nodes) as [string, NodeShape][];
  const triggers = entries.filter(([, node]) => isRecord(node) && node.type === 'trigger');
  if (triggers.length === 0) {
    errors.push({
      path: 'nodes',
      message: 'this action has no way in',
      hint: 'add a trigger step — call, webhook, schedule, render or custom'
    });
  }

  // Two ways in of the same kind is not a second flow, it is an ambiguity: the runner starts at the trigger
  // matching what fired, and two of them would make which chain runs a matter of key order.
  const kinds = new Map<string, string[]>();
  triggers.forEach(([key, node]) => {
    if (isFilledString(node.action)) {
      kinds.set(node.action, [...(kinds.get(node.action) ?? []), key]);
    }
  });
  kinds.forEach((keys, kind) => {
    if (keys.length > 1) {
      errors.push({
        path: `nodes.${keys[1]}`,
        message: `this action has ${keys.length} "${kind}" triggers`,
        hint: 'one step per way in — a second flow starts from a different kind of trigger'
      });
    }
  });

  entries.forEach(([key, node]) => {
    const path = `nodes.${key}`;
    if (!isRecord(node)) {
      errors.push({ path, message: 'must be an object' });

      return;
    }

    if (node.type === 'trigger') {
      validateTrigger(key, node, errors, warnings);

      return;
    }

    if (node.type !== 'task') {
      errors.push({
        path: `${path}.type`,
        message: `"${String(node.type)}" steps run in the browser and cannot run on the server`,
        hint: 'a server action is made of task steps'
      });

      return;
    }

    if (!isFilledString(node.action) || !TASK_NAME.test(node.action)) {
      errors.push({
        path: `${path}.action`,
        message: 'must name a task as <namespace>.<action>',
        hint: 'for example flow.output or http.request'
      });

      return;
    }

    if (isFilledString(node.afterNode) && !Object.hasOwn(nodes, node.afterNode)) {
      errors.push({ path: `${path}.afterNode`, message: `points at "${node.afterNode}", which is not a step here` });
    }
  });

  /**
   * A step's result is published in the flow scope under its own id, beside what the run already put there.
   *
   * So a step called `input` overwrites the input every later step reads from, and one called `user` overwrites
   * who is asking — silently, halfway through the flow, with nothing to say it happened. Refused here rather than
   * defended against at write time, because the author can simply rename the step and the alternative is a scope
   * whose keys mean different things depending on what a document called its steps.
   */
  entries.forEach(([key]) => {
    if (RESERVED_SCOPE_KEYS.has(key)) {
      errors.push({
        path: `nodes.${key}`,
        message: `"${key}" is what the run itself publishes in the flow scope, so a step may not take the name`,
        hint: `rename the step — every later step reads {{ ${key} }} expecting the run's own value`
      });
    }
  });

  /**
   * A step nothing points at never runs, and looks exactly like one that does. Reachability is walked from every
   * trigger rather than assumed, which is the only check that catches a chain left detached by an edit.
   *
   * The walk also NAMES the cycle it stops at. It always had to stop at one — a chain that comes back on itself
   * would otherwise walk forever — but stopping quietly let `A → B → A` validate, and the author found out in
   * production, where the runner walks the same loop until it dies with `over_capacity`. A flow that cannot end is
   * not a flow.
   */
  const reachable = new Set<string>();
  const looping = new Set<string>();
  triggers.forEach(([key]) => {
    const walked = new Set<string>();
    let current = key;
    while (current) {
      if (walked.has(current)) {
        looping.add(current);
        break;
      }

      walked.add(current);
      reachable.add(current);
      const node = nodes[current] as NodeShape | undefined;
      current = isFilledString(node?.afterNode) ? node.afterNode : '';
    }
  });
  looping.forEach(key => {
    errors.push({
      path: `nodes.${key}`,
      message: 'this step is reached again by its own chain, so the flow never ends',
      hint: 'break the `afterNode` chain that comes back to it'
    });
  });
  entries.forEach(([key]) => {
    if (!reachable.has(key)) {
      warnings.push({
        path: `nodes.${key}`,
        message: 'no trigger reaches this step, so it never runs',
        hint: 'chain it with `afterNode` from a trigger, or delete it'
      });
    }
  });

  // The output step is the contract, so where it sits in the chain is part of it: the runner reads the last one
  // that ran, and a step after it is work whose result nobody will ever see.
  const outputs = entries.filter(([, node]) => isRecord(node) && node.action === 'flow.output');
  for (const [key, node] of outputs) {
    if (isFilledString(node.afterNode) && Object.hasOwn(nodes, node.afterNode)) {
      warnings.push({
        path: `nodes.${key}.afterNode`,
        message: 'the output step is not the last one, so the steps after it run for nothing',
        hint: 'move flow.output to the end of the flow'
      });
    }
  }

  // Not an error: an action that only does something — sends, writes, charges — legitimately answers nothing.
  if (outputs.length === 0 && isRecord(output) && Object.keys(output).length > 0) {
    warnings.push({
      path: 'nodes',
      message: 'this action is expected to answer values but no step names any',
      hint: 'add a flow.output step at the end naming what the caller should get'
    });
  }
};

const CREDENTIAL_TOKEN = /\{\{\s*credential\./;

/**
 * A credential token only means something inside the step that asked for the credential.
 *
 * Credentials are not part of the flow scope — an ambient one would be interpolable by every node, `flow.output`
 * included, which is a secret handed to the browser. So a token anywhere else silently renders to nothing, and
 * the symptom is an outbound call that goes out unauthenticated and reports whatever the provider says about it.
 */
const validateCredentialTokens = (nodes: Record<string, unknown>, warnings: ActionDocumentIssue[]) => {
  Object.entries(nodes).forEach(([key, node]) => {
    if (!isRecord(node) || !isRecord(node.params)) {
      return;
    }

    const names = isFilledString(node.params.credential) ? node.params.credential : '';
    Object.entries(node.params).forEach(([param, value]) => {
      if (typeof value !== 'string' || !CREDENTIAL_TOKEN.test(value) || names !== '') {
        return;
      }

      warnings.push({
        path: `nodes.${key}.params.${param}`,
        message: 'this step reads a credential it did not ask for, so the token resolves to nothing',
        hint: 'set the step’s `credential` to the identifier it should use'
      });
    });
  });
};

export const validateActionDocument = (document: unknown): ActionDocumentReport => {
  const errors: ActionDocumentIssue[] = [];
  const warnings: ActionDocumentIssue[] = [];

  if (!isRecord(document)) {
    return { valid: false, errors: [{ path: '', message: 'the document must be an object' }], warnings };
  }

  if (!isFilledString(document.name)) {
    errors.push({ path: 'name', message: 'must have a name' });
  }

  // Derived from the output step rather than authored, so it is checked for shape and never for agreement: the
  // step is the source of truth and the runner never reads this.
  validateFields(document.output, 'output', errors);
  validateNodes(document.nodes, document.output, errors, warnings);
  validateCredentialTokens(isRecord(document.nodes) ? document.nodes : {}, warnings);

  return { valid: errors.length === 0, errors, warnings };
};
