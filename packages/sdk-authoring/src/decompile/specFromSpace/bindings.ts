import { BINDING_CATEGORIES, LEGACY_ELEMENT_TYPES, bindingsOf, conditionOf, isEmpty, correct } from './values';
import { elementCallbacks, elementSourceTypes, elementTriggers } from '../../elements';
import { BUILTIN_GLOBAL_CALLBACKS, BUILTIN_UTILITIES } from '../../interactions';
import { authorFlows, COMPONENT_SOURCES, GLOBAL_SOURCES } from '../../schema';
import { CUSTOM_TYPE } from '../../schema/lint/context';

import type { SpecReader } from './reader';
import type { BindingSpec, StepSpec } from '../../schema';
import type { BindingCategory, Element, ElementBinding, ElementInteraction } from '@plitzi/sdk-shared';

// ---------------------------------------------------------------- bindings
/**
 * A source, as an author writes it — or `undefined` when it names nothing that exists.
 *
 * A full source (`apiContainer_posts.data`) is shortened to the element's name, which is what an author writes and
 * what authoring resolves again. A prefix that does not match what the element publishes names a source nothing
 * registers, so it is corrected rather than kept.
 */
const sourceOf = (
  reader: SpecReader,
  source: string,
  at: string,
  globals: readonly string[] = GLOBAL_SOURCES
): string | undefined => {
  const [head, ...rest] = source.split('.');
  const field = rest.length > 0 ? `.${rest.join('.')}` : '';
  if (globals.includes(head)) {
    return source;
  }

  const byName = (id: string): string | undefined => {
    const element = reader.flat[id] as Element | undefined;

    return element ? elementSourceTypes[element.definition.type] : undefined;
  };

  if (byName(head)) {
    return source;
  }

  for (let index = head.indexOf('_'); index !== -1; index = head.indexOf('_', index + 1)) {
    const prefix = head.slice(0, index);
    const id = head.slice(index + 1);
    const expected = byName(id);
    if (!expected) {
      continue;
    }

    if (prefix !== expected) {
      correct(
        reader,
        'fixed-binding-source',
        `${at} read "${source}", but "${id}" publishes as "${expected}_${id}".`,
        at
      );
    }

    return `${id}${field}`;
  }

  return undefined;
};

/**
 * An element's bindings in the order they were authored, whatever category files them.
 *
 * Authoring numbers a binding by its place in the element's whole list — `initialState-1` then `attributes-2` — and
 * files it under its category, so reading category by category puts them back in a different order and every id
 * shifts. The number is the order when every id carries one; a document the builder wrote does not number them that
 * way, and keeps the category order.
 */
const bindingsInOrder = (element: Element): { category: BindingCategory; raw: ElementBinding }[] => {
  const entries = BINDING_CATEGORIES.flatMap(category =>
    bindingsOf(element.definition.bindings, category).map(raw => ({ category, raw }))
  );
  const positions = entries.map(({ category, raw }) => new RegExp(`^${category}-(\\d+)$`).exec(raw.id)?.[1]);
  if (positions.some(position => position === undefined)) {
    return entries;
  }

  return entries
    .map((entry, index) => ({ entry, position: Number(positions[index]) }))
    .sort((a, b) => a.position - b.position)
    .map(({ entry }) => entry);
};

export const readBindings = (
  reader: SpecReader,
  element: Element
): { bind?: BindingSpec[] | Record<string, string>; visible?: string | false } => {
  const hidden = element.definition.initialState?.visibility === false;
  const specs: BindingSpec[] = [];
  let visible: string | false | undefined = hidden ? false : undefined;
  const ordered = bindingsInOrder(element);

  for (const [index, { category, raw }] of ordered.entries()) {
    const at = `"${element.id}"`;
    const globals = reader.componentElements.has(element.id) ? COMPONENT_SOURCES : GLOBAL_SOURCES;
    const source = sourceOf(reader, raw.source, at, globals);
    if (!source) {
      correct(
        reader,
        'broken-binding',
        `${at} bound ${raw.to} to "${raw.source}", which nothing publishes; dropped.`,
        element.id
      );
      continue;
    }

    const transformers = (raw.transformers ?? []).filter(transformer => transformer.action);
    const when = conditionOf(raw.when);
    const spec: BindingSpec = {
      to: raw.to,
      source,
      ...(category === 'attributes' ? {} : { category }),
      ...(transformers.length > 0 ? { transformers } : {}),
      ...(when ? { when } : {}),
      ...(raw.enabled === false ? { enabled: false } : {})
    };

    // The one binding with a field of its own: a condition that starts the element hidden. Only the LAST binding,
    // because that is where the field is authored back — taken from the middle, it would move to the end.
    const negated = transformers.length === 1 && transformers[0].action === 'not' && isEmpty(transformers[0].params);
    if (
      visible === false &&
      index === ordered.length - 1 &&
      category === 'initialState' &&
      raw.to === 'visibility' &&
      !when &&
      raw.enabled !== false &&
      (transformers.length === 0 || negated)
    ) {
      visible = negated ? `!${source}` : source;
      continue;
    }

    specs.push(spec);
  }

  if (specs.length === 0) {
    return { ...(visible === undefined ? {} : { visible }) };
  }

  const short = specs.every(spec => Object.keys(spec).length === 2);

  return {
    bind: short ? Object.fromEntries(specs.map(spec => [spec.to, spec.source])) : specs,
    ...(visible === undefined ? {} : { visible })
  };
};

// ---------------------------------------------------------------- flows
export const readFlows = (reader: SpecReader, element: Element): { flows?: StepSpec[][] } => {
  const nodes = element.definition.interactions;
  if (!nodes || isEmpty(nodes)) {
    return {};
  }

  const reached = new Set<string>();
  const flows: ElementInteraction[][] = [];
  for (const node of Object.values(nodes)) {
    if (node.beforeNode && Object.hasOwn(nodes, node.beforeNode)) {
      continue;
    }

    const chain: ElementInteraction[] = [];
    for (let current: ElementInteraction | undefined = node; current && !reached.has(current.id);) {
      reached.add(current.id);
      chain.push(current);
      current = current.afterNode && Object.hasOwn(nodes, current.afterNode) ? nodes[current.afterNode] : undefined;
    }

    if (chain.some(step => !step.action)) {
      correct(
        reader,
        'broken-flow',
        `"${element.id}" had a flow with a step that runs nothing (${chain[0].id}); dropped.`,
        element.id
      );
      continue;
    }

    const live = liveSteps(reader, chain, element);
    if (live.length > 0) {
      flows.push(live);
    }
  }

  const lost = Object.keys(nodes).filter(id => !reached.has(id));
  if (lost.length > 0) {
    correct(
      reader,
      'broken-flow',
      `"${element.id}" had steps no flow reaches (${lost.join(', ')}); dropped.`,
      element.id
    );
  }

  if (flows.length === 0) {
    return {};
  }

  const anonymous = flows.map(chain => chain.map(node => readStep(reader, node, element.id)));
  const named = flows.map((chain, flow) => chain.map((node, index) => ({ id: node.id, ...anonymous[flow][index] })));

  // Ids are left out only when authoring would derive exactly the same ones — a later step may read an earlier one
  // by id (`{{ webHook-1.response }}`), so a flow either keeps every id it had or needs none of them written.
  const derived = Object.keys(authorFlows(anonymous, element.id));
  const original = flows.flat().map(node => node.id);

  return { flows: derived.join() === original.join() ? anonymous : named };
};

/**
 * What of a flow can still run: a trigger its element never fires sinks the whole flow, and a callback its target
 * never answers to is a step that does nothing.
 *
 * Both are what an older builder leaves behind — an animation step from before animations were removed, a submit
 * flow on a button — and authoring refuses both, so they are dropped here and reported rather than written into a
 * spec that could not be authored again. Only built-in types are judged: a plugin's registers what nobody here sees —
 * and so does a `custom` host, whose triggers and callbacks are the component it renders, never `custom`'s own.
 */
const liveSteps = (reader: SpecReader, chain: ElementInteraction[], element: Element): ElementInteraction[] => {
  const typeOf = (id: string): string | undefined => {
    const type = (reader.flat[id] as Element | undefined)?.definition.type;
    if (type === CUSTOM_TYPE) {
      return undefined;
    }

    return type && Object.hasOwn(LEGACY_ELEMENT_TYPES, type) ? LEGACY_ELEMENT_TYPES[type].type : type;
  };
  const offers = (catalog: Record<string, string[]>, id: string, action: string): boolean => {
    const type = typeOf(id);

    return !type || !Object.hasOwn(catalog, type) || catalog[type].includes(action);
  };

  const trigger = chain[0];
  const firedOn = trigger.elementId ?? element.id;
  if (trigger.type === 'trigger' && firedOn === element.id && !offers(elementTriggers, firedOn, trigger.action)) {
    correct(
      reader,
      'dead-flow',
      `"${element.id}" had a flow on "${trigger.action}", which a "${String(typeOf(firedOn))}" never fires; dropped.`,
      element.id
    );

    return [];
  }

  return chain.filter(node => {
    const target = node.elementId ?? element.id;
    if (node.type !== 'callback' || offers(elementCallbacks, target, node.action)) {
      return true;
    }

    correct(
      reader,
      'dead-step',
      `"${element.id}" sent "${node.action}" to "${target}", a "${String(typeOf(target))}" that never answers to it; dropped.`,
      element.id
    );

    return false;
  });
};

/**
 * A step's params, without the ones its action does not take.
 *
 * The builder's panel kept a field it had shown for another action when the action changed — a `navigate` carrying a
 * `setState`'s `key` and `type` — and nothing ever read it. Authoring refuses a param a closed action does not take,
 * so it is left out here, and said.
 */
const readStepParams = (reader: SpecReader, node: ElementInteraction, host: string): Record<string, unknown> => {
  const params: Record<string, unknown> = { ...node.params };
  const catalog =
    node.type === 'globalCallback' && Object.hasOwn(BUILTIN_GLOBAL_CALLBACKS, node.action)
      ? BUILTIN_GLOBAL_CALLBACKS[node.action]
      : node.type === 'utility' && Object.hasOwn(BUILTIN_UTILITIES, node.action)
        ? BUILTIN_UTILITIES[node.action]
        : undefined;
  if (!catalog?.strictParams) {
    return params;
  }

  return Object.fromEntries(
    Object.entries(params).filter(([key]) => {
      if (Object.hasOwn(catalog.params, key)) {
        return true;
      }

      correct(reader, 'dropped-param', `"${host}" gave ${node.action} a "${key}" it does not take; dropped.`, host);

      return false;
    })
  );
};

const readStep = (reader: SpecReader, node: ElementInteraction, host: string): Omit<StepSpec, 'id'> => {
  let on: string | undefined;
  if (node.type === 'globalCallback') {
    const declared = BUILTIN_GLOBAL_CALLBACKS[node.action] as { source: string } | undefined;
    on = node.elementId ?? undefined;
    if (declared && node.elementId !== declared.source) {
      correct(
        reader,
        'fixed-global-callback',
        `"${host}" ran ${node.action} on "${String(node.elementId)}", but it is registered on "${declared.source}".`,
        host
      );
      on = declared.source;
    }
  } else if (node.type === 'trigger' || node.type === 'callback') {
    on = node.elementId && node.elementId !== host ? node.elementId : undefined;
  }

  const when = conditionOf(node.when);
  const params = readStepParams(reader, node, host);

  return {
    type: node.type,
    action: node.action,
    ...(node.title && node.title !== node.action ? { title: node.title } : {}),
    ...(isEmpty(params) ? {} : { params }),
    ...(isEmpty(node.preview) ? {} : { preview: node.preview }),
    ...(on ? { on } : {}),
    ...(when ? { when } : {}),
    ...(!node.enabled ? { enabled: false } : {}),
    ...(node.type === 'trigger' && node.whileRunning ? { whileRunning: node.whileRunning } : {})
  };
};
