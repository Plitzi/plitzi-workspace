import { interactionBasicTriggers } from '@plitzi/sdk-elements/Element/helpers/elementConstants';
import { BUILTIN_ELEMENT_CALLBACKS } from '@plitzi/sdk-shared/authoring/elementCallbacks';

import {
  elementAncestorTypes,
  elementAttributeNames,
  elementAttributeValues,
  elementCallbacks,
  elementCatalog,
  elementDefaultAttributes,
  elementLeafTypes,
  elementSlots,
  elementSourceTypes,
  elementTriggers,
  typeCallbackDefinitions,
  typeTriggerDefinitions
} from '../elements';
import * as elementSteps from '../elements/steps';
import { BUILTIN_GLOBAL_CALLBACKS, BUILTIN_UTILITIES } from '../interactions';
import * as interactionSteps from '../interactions/steps';
import { authoringCodeEntry, AUTHORING_CODES } from '../schema/codes';
import { BUILTIN_TRANSFORMERS } from '../transformers';
import { BUILDER_SIGNATURES, builderCall } from './builders';
import { AUTHORING_HELPERS, MOTION_ENTRY } from './helpers';

import type { AuthoringCodeEntry } from '../schema/codes';
import type { InteractionCallback, InteractionCallbackParam } from '@plitzi/sdk-shared';
import type { ParamSpec } from '@plitzi/sdk-shared/authoring/paramSpec';

/**
 * What a name means in the authoring surface — an element type, a step, a trigger, a problem's code, a transformer —
 * answered from the catalogues the checks themselves read, so it cannot say anything they do not.
 *
 * The question an agent otherwise answers by searching eight thousand lines of `.d.ts`: what does `navigate` take,
 * what does `onPageLoad` hand its flow, what attributes has a `container`. `plitzi explain` prints it, and the MCP
 * serves it, from here.
 */

export interface ParamInfo {
  name: string;
  type: string;
  description?: string;
  default?: unknown;
  options?: readonly string[];
  required?: boolean;
}

export type Explanation =
  | {
      kind: 'element';
      name: string;
      label: string;
      description: string;
      factory: string;
      attributes: { name: string; default?: unknown; values?: readonly string[] }[];
      triggers: string[];
      callbacks: string[];
      slots: string[];
      /** The type it has to be inside, for one that only works in another. */
      inside?: string;
      /** The name its data source is published under: `<source>_<id>`. */
      source?: string;
      holdsChildren: boolean;
    }
  | {
      kind: 'step';
      name: string;
      title: string;
      /** How the runtime finds it: a global callback by its module, an element callback on an element, a utility alone. */
      type: 'globalCallback' | 'callback' | 'utility';
      /** The authoring function that writes it, when there is one. */
      builder?: string;
      /** The element types that answer to it, for an element callback. */
      answeredBy?: string[];
      params: ParamInfo[];
      /** What a later step reads of it, named: `{{ <step>.field }}` — and the only fields a `when` can ask it about. */
      reads: string[];
    }
  | {
      kind: 'trigger';
      name: string;
      title: string;
      builder?: string;
      /** What a flow it starts reads: `{{ <step>.field }}`. */
      reads: string[];
      /** The types that fire it — every element, or the ones named. */
      firedBy: string[] | 'every element';
      params: ParamInfo[];
    }
  | { kind: 'code'; name: string; codeKind: AuthoringCodeEntry['kind']; means: string; fix: string }
  | { kind: 'transformer'; name: string; title: string; description: string; params: ParamInfo[] }
  | { kind: 'helper'; name: string; signature: string; summary: string; example: string };

export type ExplainKind = Explanation['kind'];

/** What each kind is called when listed. */
export const EXPLAIN_KINDS: Record<ExplainKind, string> = {
  element: 'elements',
  step: 'steps',
  trigger: 'triggers',
  code: 'codes',
  transformer: 'transformers',
  helper: 'helpers'
};

const isExplainKind = (kind: string): kind is ExplainKind => Object.hasOwn(EXPLAIN_KINDS, kind);

/** A kind by what it is called when listed (`steps`) or by itself (`step`). */
export const explainKindOf = (name: string): ExplainKind | undefined =>
  Object.keys(EXPLAIN_KINDS)
    .filter(isExplainKind)
    .find(kind => kind === name || EXPLAIN_KINDS[kind] === name);

const fromSpec = (spec: ParamSpec): ParamInfo[] =>
  Object.entries(spec).map(([name, param]) => ({
    name,
    type: param.type,
    description: param.description,
    ...(param.default === undefined ? {} : { default: param.default }),
    ...(param.options ? { options: param.options } : {}),
    ...(param.required ? { required: true } : {})
  }));

const optionsOf = (param: InteractionCallbackParam): readonly string[] | undefined => {
  if (!('options' in param) || !Array.isArray(param.options)) {
    return undefined;
  }

  return param.options.flatMap((option: unknown) => {
    if (typeof option === 'string') {
      return [option];
    }

    return typeof option === 'object' && option !== null && 'value' in option ? [String(option.value)] : [];
  });
};

const fromCallback = (callback: InteractionCallback): ParamInfo[] =>
  // Params that depend on what the node already holds are a function: there is no fixed list to say.
  Object.entries<InteractionCallbackParam>(typeof callback.params === 'function' ? {} : callback.params).map(
    ([name, param]) => {
      const options = optionsOf(param);

      return {
        name,
        // A control chosen by what the node holds has no one type: it is the one the editor shows.
        type: typeof param.type === 'function' ? 'depends on the other params' : param.type,
        ...(param.label ? { description: param.label } : {}),
        ...('defaultValue' in param && param.defaultValue !== undefined ? { default: param.defaultValue } : {}),
        ...(options ? { options } : {})
      };
    }
  );

/** The functions authoring writes steps with, by their exported name. */
const builders = new Set(
  Object.entries({ ...interactionSteps, ...elementSteps })
    .filter(([, value]) => typeof value === 'function')
    .map(([name]) => name)
);

/**
 * The builder of an action whose builder is not named after it. Checked by a test against the exports, so a renamed
 * builder breaks the build rather than this answer.
 */
export const BUILDER_NAMES: Record<string, string> = {
  setState: 'updateElement',
  toggleState: 'toggleElement',
  performQuery: 'reloadApi',
  cancelQuery: 'cancelApi',
  delayTime: 'delay'
};

/**
 * The builder of a global callback not named after its action. Apart from {@link BUILDER_NAMES} because that table is
 * the element callbacks': `setState` the global callback is written `setState(…)`, the element one `updateElement(…)`.
 * The auth builders keep a prefix the actions do not have — a bare `login` would be too vague at an import.
 */
export const GLOBAL_CALLBACK_BUILDERS: Record<string, string> = {
  login: 'authLogin',
  logout: 'authLogout',
  refreshDetails: 'authRefreshDetails'
};

/** The step a builder writes when the builder is not named after it: `reloadApi` is how `performQuery` is written. */
const stepOfBuilder = (name: string): string | undefined =>
  Object.entries({ ...BUILDER_NAMES, ...GLOBAL_CALLBACK_BUILDERS }).find(([, builder]) => builder === name)?.[0];

const builderOf = (action: string, type: string): string | undefined => {
  const named =
    type === 'globalCallback' ? (GLOBAL_CALLBACK_BUILDERS[action] ?? action) : (BUILDER_NAMES[action] ?? action);

  return builders.has(named) ? named : undefined;
};

const definitionIn = (catalog: Record<string, InteractionCallback>, name: string): InteractionCallback | undefined =>
  Object.hasOwn(catalog, name) ? catalog[name] : undefined;

const triggerDefinition = (name: string): InteractionCallback | undefined =>
  definitionIn(interactionBasicTriggers, name) ?? definitionIn(typeTriggerDefinitions, name);

/** The attributes each type is authored with; `null` for one that takes any, which is said by its defaults. */
const attributeNames: Record<string, readonly string[] | null> = elementAttributeNames;

const explainElement = (type: string): Explanation | undefined => {
  if (!Object.hasOwn(elementCatalog, type)) {
    return undefined;
  }

  const defaults = elementDefaultAttributes[type] ?? {};
  const values = elementAttributeValues[type] ?? {};
  const names = attributeNames[type] ?? Object.keys(defaults);

  return {
    kind: 'element',
    name: type,
    label: elementCatalog[type].label,
    description: elementCatalog[type].description,
    factory: `${type}({ … })`,
    attributes: names.map(name => ({
      name,
      ...(Object.hasOwn(defaults, name) ? { default: defaults[name] } : {}),
      ...(Object.hasOwn(values, name) ? { values: values[name] } : {})
    })),
    triggers: elementTriggers[type] ?? [],
    callbacks: elementCallbacks[type] ?? [],
    slots: elementSlots[type] ?? [],
    ...(Object.hasOwn(elementAncestorTypes, type) ? { inside: elementAncestorTypes[type] } : {}),
    ...(Object.hasOwn(elementSourceTypes, type) ? { source: elementSourceTypes[type] } : {}),
    holdsChildren: !elementLeafTypes.includes(type)
  };
};

const explainTrigger = (name: string): Explanation | undefined => {
  const definition = triggerDefinition(name);
  if (!definition) {
    return undefined;
  }

  const basic = Object.hasOwn(interactionBasicTriggers, name);

  return {
    kind: 'trigger',
    name,
    title: definition.title,
    ...(builders.has(name) ? { builder: name } : {}),
    reads: Object.keys(definition.preview ?? {}),
    firedBy: basic
      ? 'every element'
      : Object.entries(elementTriggers)
          .filter(([, triggers]) => triggers.includes(name))
          .map(([type]) => type),
    params: fromCallback(definition)
  };
};

const explainSteps = (name: string): Explanation[] => {
  const steps: Explanation[] = [];
  if (Object.hasOwn(BUILTIN_GLOBAL_CALLBACKS, name)) {
    const step = BUILTIN_GLOBAL_CALLBACKS[name];
    const builder = builderOf(name, 'globalCallback');
    steps.push({
      kind: 'step',
      name,
      title: step.title,
      type: 'globalCallback',
      ...(builder ? { builder } : {}),
      params: fromSpec(step.params),
      reads: Object.keys(step.preview ?? {})
    });
  }

  const shared = Object.hasOwn(BUILTIN_ELEMENT_CALLBACKS, name);
  const definition = definitionIn(typeCallbackDefinitions, name);
  if (shared || definition) {
    const builder = builderOf(name, 'callback');
    // A type's own callback is said from its definition; the ones every element answers to, from their declaration.
    const own = shared ? undefined : definition;
    steps.push({
      kind: 'step',
      name,
      title: own ? own.title : BUILTIN_ELEMENT_CALLBACKS[name].title,
      type: 'callback',
      ...(builder ? { builder } : {}),
      answeredBy: Object.entries(elementCallbacks)
        .filter(([, callbacks]) => callbacks.includes(name))
        .map(([type]) => type),
      params: own ? fromCallback(own) : fromSpec(BUILTIN_ELEMENT_CALLBACKS[name].params),
      reads: Object.keys((own ? own.preview : BUILTIN_ELEMENT_CALLBACKS[name].preview) ?? {})
    });
  }

  if (Object.hasOwn(BUILTIN_UTILITIES, name)) {
    const utility = BUILTIN_UTILITIES[name];
    const builder = builderOf(name, 'utility');
    steps.push({
      kind: 'step',
      name,
      title: utility.title,
      type: 'utility',
      ...(builder ? { builder } : {}),
      params: fromSpec(utility.params),
      reads: Object.keys(utility.preview ?? {})
    });
  }

  return steps;
};

/** The helpers `explain` knows, `motion` with them: an element's field said as one. */
const HELPERS: Readonly<Record<string, (typeof AUTHORING_HELPERS)[string]>> = {
  ...AUTHORING_HELPERS,
  motion: MOTION_ENTRY
};

/** Everything a name is — an action can be both a global and an element callback (`setState`), and is said as both. */
export const explain = (name: string): Explanation[] => {
  const code = authoringCodeEntry(name);
  const element = explainElement(name);
  const trigger = explainTrigger(name);
  const transformer = Object.hasOwn(BUILTIN_TRANSFORMERS, name) ? BUILTIN_TRANSFORMERS[name] : undefined;
  const helper = Object.hasOwn(HELPERS, name) ? HELPERS[name] : undefined;
  // Asked by the name the code calls it: what `reloadApi(…)` writes is the `performQuery` step.
  const builtStep = stepOfBuilder(name);

  return [
    ...(code ? [{ kind: 'code' as const, name, codeKind: code.kind, means: code.means, fix: code.fix }] : []),
    ...(element ? [element] : []),
    ...(trigger ? [trigger] : []),
    ...explainSteps(name),
    ...(builtStep ? explainSteps(builtStep) : []),
    ...(transformer
      ? [
          {
            kind: 'transformer' as const,
            name,
            title: transformer.title,
            description: transformer.description,
            params: fromSpec(transformer.params)
          }
        ]
      : []),
    ...(helper ? [{ kind: 'helper' as const, name, ...helper }] : [])
  ];
};

/** Every name of one kind, with a line about each — what to ask `explain` about next. */
export const explainList = (kind: ExplainKind): { name: string; summary: string }[] => {
  const sorted = (entries: { name: string; summary: string }[]) => entries.sort((a, b) => a.name.localeCompare(b.name));

  switch (kind) {
    case 'element':
      return sorted(Object.entries(elementCatalog).map(([name, element]) => ({ name, summary: element.label })));
    case 'trigger':
      return sorted(
        [...new Set([...Object.keys(interactionBasicTriggers), ...Object.keys(typeTriggerDefinitions)])].map(name => ({
          name,
          summary: triggerDefinition(name)?.title ?? name
        }))
      );
    case 'step':
      return sorted([
        ...Object.entries(BUILTIN_GLOBAL_CALLBACKS).map(([name, step]) => ({ name, summary: step.title })),
        ...Object.entries({ ...typeCallbackDefinitions, ...BUILTIN_ELEMENT_CALLBACKS }).map(([name, step]) => ({
          name,
          summary: `${step.title} (on an element)`
        })),
        ...Object.entries(BUILTIN_UTILITIES).map(([name, step]) => ({ name, summary: step.title }))
      ]);
    case 'code':
      return sorted(
        Object.entries(AUTHORING_CODES).map(([name, entry]) => ({ name, summary: `${entry.kind}: ${entry.means}` }))
      );
    case 'transformer':
      return sorted(Object.entries(BUILTIN_TRANSFORMERS).map(([name, entry]) => ({ name, summary: entry.title })));
    case 'helper':
      return sorted(Object.entries(HELPERS).map(([name, entry]) => ({ name, summary: entry.summary })));
  }
};

const valueText = (value: unknown): string => JSON.stringify(value);

const paramsText = (params: ParamInfo[]): string[] =>
  params.length === 0
    ? ['  (no params)']
    : params.map(
        param =>
          `  ${param.name}${param.required ? '' : '?'}: ${param.options ? param.options.map(option => `'${option}'`).join(' | ') : param.type}${param.default === undefined ? '' : ` = ${valueText(param.default)}`}${param.description ? ` — ${param.description}` : ''}`
      );

const stepPlace = (type: 'globalCallback' | 'callback' | 'utility', answeredBy: string[] = []): string => {
  if (type === 'callback') {
    return `on an element: ${answeredBy.join(', ')}`;
  }

  return type === 'utility' ? 'a utility' : 'a global callback';
};

/** One explanation as text, for a person or an agent reading a terminal. */
export const explanationText = (explanation: Explanation): string => {
  switch (explanation.kind) {
    case 'element':
      return [
        `${explanation.name} — element: ${explanation.label}. ${explanation.description}`,
        `Written: ${explanation.factory}${explanation.holdsChildren ? ', with children' : '; holds no children'}${explanation.inside ? `, only inside a ${explanation.inside}` : ''}${explanation.source ? `; publishes ${explanation.source}_<id>` : ''}`,
        'Attributes:',
        ...explanation.attributes.map(
          attribute =>
            `  ${attribute.name}${attribute.values ? `: ${attribute.values.map(value => `'${value}'`).join(' | ')}` : ''}${attribute.default === undefined ? '' : ` = ${valueText(attribute.default)}`}`
        ),
        `Fires: ${explanation.triggers.join(', ')}`,
        `Answers: ${explanation.callbacks.join(', ')}`,
        ...(explanation.slots.length > 0 ? [`Slots: ${explanation.slots.join(', ')}`] : [])
      ].join('\n');
    case 'step':
      return [
        `${explanation.name} — step (${stepPlace(explanation.type, explanation.answeredBy)}): ${explanation.title}`,
        ...(explanation.builder ? [`Written: ${builderCall(explanation.builder)}`] : []),
        'Params:',
        ...paramsText(explanation.params),
        `Reads: ${explanation.reads.length > 0 ? `${explanation.reads.join(', ')} — named('x', …), then {{ x.${explanation.reads[0]} }} or when({ field: 'x.${explanation.reads[0]}', … })` : '(nothing)'}`
      ].join('\n');
    case 'trigger':
      return [
        `${explanation.name} — trigger: ${explanation.title}. Fired by ${Array.isArray(explanation.firedBy) ? explanation.firedBy.join(', ') : explanation.firedBy}.`,
        `Written: ${explanation.builder ? (BUILDER_SIGNATURES[explanation.builder] ?? `${explanation.builder}()`) : `on('${explanation.name}')`}; name it to read what it hands over — [named('x', …), …] then {{ x.field }}`,
        `Reads: ${explanation.reads.length > 0 ? explanation.reads.join(', ') : '(nothing)'}`,
        ...(explanation.params.length > 0 ? ['Params:', ...paramsText(explanation.params)] : [])
      ].join('\n');
    case 'code':
      return [
        `${explanation.name} — ${explanation.codeKind}: ${explanation.means}.`,
        // A suggestion is not a mistake: what it names is written the long way, and this is the short one.
        `${explanation.codeKind === 'suggested' ? 'The short way' : 'Write instead'}: ${explanation.fix}.`
      ].join('\n');
    case 'transformer':
      return [
        `${explanation.name} — transformer: ${explanation.title}. ${explanation.description}`,
        'Params:',
        ...paramsText(explanation.params)
      ].join('\n');
    case 'helper':
      return [
        `${explanation.name} — helper: ${explanation.summary}`,
        `Written: ${explanation.signature}`,
        `Example: ${explanation.example}`
      ].join('\n');
  }
};
