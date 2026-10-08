import { FAILURE_HANDLER_TASK } from '@plitzi/sdk-shared/actions';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { camel, literal, withSuffix } from './literal';
import { defineAction } from '../schema/actions';

import type { AccessSpec, ActionSpec, ActionStepSpec, ActionTriggerSpec, WebhookVerifySpec } from '../schema/actions';
import type { ActionDocument, ActionEntry, ActionField, ActionFieldType, ElementInteraction } from '@plitzi/sdk-shared';

/**
 * A server action read back into the `defineAction` call that writes it: the other direction from {@link defineAction},
 * as `specFromSpace` is for a space.
 *
 * Only when the round trip is exact. The spec read is authored again and compared with the document it came from —
 * every step, every chain link, every param — and a document that would come back any different is not read at all:
 * the reason is given instead, and the document stays the JSON it is. A builder can write flows code has no words for
 * (a branch, a step titled by hand), and a decompiler that approximated them would hand back a different action.
 */

export type ActionReading = { ok: true; spec: ActionSpec } | { ok: false; reason: string };

const OUTPUT_TASK = 'flow.output';
const TRIGGER_TYPES = ['call', 'render', 'webhook', 'custom', 'schedule', 'later'] as const;
const FIELD_TYPES: readonly ActionFieldType[] = ['text', 'number', 'boolean', 'date', 'json', 'file'];

type TriggerType = (typeof TRIGGER_TYPES)[number];

class Unreadable extends Error {}

const refuse = (reason: string): never => {
  throw new Unreadable(reason);
};

const isTriggerType = (value: string): value is TriggerType => TRIGGER_TYPES.some(type => type === value);

const isNode = (value: unknown): value is ElementInteraction =>
  isRecord(value) &&
  ['id', 'title', 'type', 'action', 'beforeNode', 'afterNode', 'flowId'].every(key => typeof value[key] === 'string') &&
  typeof value.enabled === 'boolean' &&
  isRecord(value.params) &&
  isRecord(value.preview);

/** A document with the shape an action has: whether it is the action code writes is what the round trip answers. */
const isDocument = (value: unknown): value is ActionDocument =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  isRecord(value.nodes) &&
  Object.values(value.nodes).every(isNode);

const isField = (value: unknown): value is ActionField =>
  isRecord(value) && FIELD_TYPES.some(type => type === value.type);

const text = (params: Record<string, unknown>, key: string): string | undefined => {
  const value = params[key];

  return typeof value === 'string' ? value : undefined;
};

/** The JSON a param holds, or `undefined` when it holds none — a value the round trip then tells apart. */
const parsed = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const inputOf = (node: ElementInteraction): Record<string, ActionField> | undefined => {
  const raw = text(node.params, 'input');
  if (raw === undefined) {
    return undefined;
  }

  const value = parsed(raw);
  if (!isRecord(value) || !Object.values(value).every(isField)) {
    return refuse(`the trigger "${node.id}" declares an input that is not a map of fields`);
  }

  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, ActionField] => isField(entry[1])));
};

const accessOf = (node: ElementInteraction): AccessSpec => {
  const mode = text(node.params, 'access');
  if (mode === 'public' || mode === 'session') {
    return mode;
  }

  if (mode === 'role') {
    return { mode, permissions: (text(node.params, 'permissions') ?? '').split(',').filter(Boolean) };
  }

  return refuse(`the trigger "${node.id}" states no one who may start it`);
};

const verifyOf = (node: ElementInteraction): WebhookVerifySpec | undefined => {
  const credential = text(node.params, 'signatureCredential');
  if (!credential) {
    return undefined;
  }

  const header = text(node.params, 'signatureHeader');
  const algorithm = text(node.params, 'signatureAlgorithm');
  const secretField = text(node.params, 'signatureSecretField');
  const timestampHeader = text(node.params, 'signatureTimestampHeader');
  const tolerance = text(node.params, 'signatureToleranceSeconds');

  return {
    credential,
    ...(header ? { header } : {}),
    ...(algorithm === 'sha256' || algorithm === 'sha1' ? { algorithm } : {}),
    ...(secretField ? { secretField } : {}),
    ...(timestampHeader ? { timestampHeader } : {}),
    ...(tolerance === undefined ? {} : { toleranceSeconds: Number(tolerance) })
  };
};

/** A way in, as its declaration — with the id left out where `defineAction` would choose the same one. */
const triggerOf = (node: ElementInteraction, defaultId: string): ActionTriggerSpec => {
  const type = node.action;
  if (!isTriggerType(type)) {
    return refuse(`the trigger "${node.id}" is a "${type}", which code does not declare`);
  }

  if (node.when || node.whileRunning) {
    return refuse(`the trigger "${node.id}" carries a condition of its own`);
  }

  const common = {
    ...(node.id === defaultId ? {} : { id: node.id }),
    ...(node.params.input === undefined ? {} : { input: inputOf(node) }),
    ...(node.enabled ? {} : { enabled: false })
  };
  if (type === 'schedule') {
    const cron = text(node.params, 'cron') ?? refuse(`the schedule "${node.id}" names no cron`);
    const timezone = text(node.params, 'timezone');

    return { ...common, type, cron, ...(timezone ? { timezone } : {}) };
  }

  if (type === 'later') {
    return { ...common, type };
  }

  const access = accessOf(node);
  if (type === 'render') {
    const cacheSeconds = text(node.params, 'cacheSeconds');

    return { ...common, type, access, ...(cacheSeconds === undefined ? {} : { cacheSeconds: Number(cacheSeconds) }) };
  }

  if (type === 'webhook') {
    const verify = verifyOf(node);

    return { ...common, type, access, ...(verify ? { verify } : {}) };
  }

  if (type === 'custom') {
    return {
      ...common,
      type,
      access,
      name: text(node.params, 'name') ?? refuse(`the trigger "${node.id}" is unnamed`)
    };
  }

  return { ...common, type, access };
};

/** What a step takes when it names no params: every field the ways in declare, if they all declare the same. */
const passthroughOf = (triggers: ActionTriggerSpec[]): Record<string, string> | undefined => {
  const fields = triggers.map(trigger =>
    Object.keys(trigger.input ?? {})
      .sort()
      .join(',')
  );

  return new Set(fields).size > 1
    ? undefined
    : Object.fromEntries(Object.keys(triggers[0]?.input ?? {}).map(field => [field, `{{input.${field}}}`]));
};

const stepOf = (node: ElementInteraction, passthrough: Record<string, string> | undefined): ActionStepSpec => {
  if (node.type !== 'task') {
    return refuse(`the step "${node.id}" is a ${node.type}, and an action runs tasks`);
  }

  if (node.title !== node.action) {
    return refuse(`the step "${node.id}" is titled "${node.title}", and code titles a step by its task`);
  }

  const { credential, ...params } = node.params;
  const named = typeof credential === 'string' && credential !== '';

  return {
    id: node.id,
    task: node.action,
    ...(JSON.stringify(named ? params : node.params) === JSON.stringify(passthrough)
      ? {}
      : { params: named ? params : node.params }),
    ...(node.when ? { when: node.when } : {}),
    ...(named ? { credential } : {}),
    ...(node.enabled ? {} : { enabled: false })
  };
};

/** The steps from a node on, as the chain links them. */
const chainFrom = (nodes: Record<string, ElementInteraction>, first: string): ElementInteraction[] => {
  const chain: ElementInteraction[] = [];
  for (let id = first; id !== '';) {
    const node = Object.hasOwn(nodes, id) ? nodes[id] : refuse(`a step points at "${id}", which is not there`);
    if (chain.includes(node)) {
      return refuse(`the steps loop back to "${id}"`);
    }

    chain.push(node);
    id = node.afterNode;
  }

  return chain;
};

/** A value with its keys in one order and its JSON params read, so two documents compare by what they hold. */
const comparable = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(comparable);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .filter(key => value[key] !== undefined)
      .sort()
      .map(key => {
        const inner = value[key];

        // A field map is JSON in a string: the builder's editor may space it out, and it means the same either way.
        return [key, key === 'input' && typeof inner === 'string' ? (parsed(inner) ?? inner) : comparable(inner)];
      })
  );
};

/** The document as code writes it: `output` is derived from the output step on save, and is not part of it. */
const written = ({ document }: ActionEntry): unknown =>
  comparable({
    name: document.name,
    description: document.description,
    nodes: document.nodes,
    limits: document.limits
  });

const read = (entry: ActionEntry): ActionSpec => {
  const { document } = entry;
  const nodes = document.nodes;
  const triggers = Object.values(nodes).filter(node => node.type === 'trigger');
  const head = triggers.find(node => node.id === node.flowId && node.beforeNode === '');
  if (!head) {
    return refuse('no way in heads its flow');
  }

  const chain = chainFrom(nodes, head.id);
  const answerAt = chain.findIndex(node => node.action === OUTPUT_TASK);
  if (answerAt === -1) {
    return refuse('it gives no answer: there is no flow.output step');
  }

  const answer = chain[answerAt];
  const doors = triggers.filter(node => node !== head);
  const defaultId = (node: ElementInteraction): string => (doors.length === 0 ? 'start' : node.action);
  const ways = [head, ...doors].map(node => triggerOf(node, defaultId(node)));
  const passthrough = passthroughOf(ways);
  const steps = chain.slice(1, answerAt).map(node => stepOf(node, passthrough));
  const handler = chain.at(answerAt + 1);
  if (handler && handler.action !== FAILURE_HANDLER_TASK) {
    return refuse(`"${handler.id}" runs after the answer, where only ${FAILURE_HANDLER_TASK} may`);
  }

  const undo = chain.slice(answerAt + 2);
  const last = steps.at(-1);
  const values = text(answer.params, 'values');

  return {
    id: entry.id,
    name: document.name,
    ...(document.description ? { description: document.description } : {}),
    trigger: ways.length === 1 ? ways[0] : ways,
    steps,
    ...(undo.length > 0 ? { onFailure: undo.map(node => stepOf(node, passthrough)) } : {}),
    ...(values === undefined || (last && values === `{{ ${last.id} }}`) ? {} : { output: values }),
    ...(document.limits ? { limits: document.limits } : {})
  };
};

/** Whether the declaration authors exactly the document it was read from. */
const sameAsWritten = (entry: ActionEntry, spec: ActionSpec): boolean => {
  try {
    return JSON.stringify(written(defineAction(spec))) === JSON.stringify(written(entry));
  } catch {
    return false;
  }
};

/**
 * The declaration that writes this action, or why there is none. See the module's comment. The document is whatever
 * JSON arrived — a platform's export, a file — and one without an action's shape is answered, never thrown on.
 */
export const actionSpecFromEntry = ({ id, document }: { id: string; document: unknown }): ActionReading => {
  if (!isDocument(document)) {
    return { ok: false, reason: 'it is not an action document' };
  }

  const entry: ActionEntry = { id, document };
  try {
    const spec = read(entry);
    if (!sameAsWritten(entry, spec)) {
      return { ok: false, reason: 'written as code it would not be the same document' };
    }

    return { ok: true, spec };
  } catch (error) {
    if (error instanceof Unreadable) {
      return { ok: false, reason: error.message };
    }

    throw error;
  }
};

export interface ActionSourceOptions {
  /** Where `defineAction` is imported from. */
  packageName?: string;
}

export type ActionSource = {
  /** What the file exports the action as: its id in camelCase, `boardCreateAction`. */
  exportName: string;
  source: string;
};

/**
 * A declaration written out as the module that holds it. Valid but unformatted, as `specToSource`'s is: run it through
 * the project's formatter.
 */
export const actionToSource = (
  spec: ActionSpec,
  { packageName = '@plitzi/sdk-authoring' }: ActionSourceOptions = {}
): ActionSource => {
  const exportName = withSuffix(camel(spec.id), 'Action');

  return {
    exportName,
    source: `import { defineAction } from '${packageName}';\n\nexport const ${exportName} = defineAction(${literal(spec)});\n`
  };
};
