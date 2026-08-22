import type { BuiltinParam, ParamSpec } from './paramSpec';
import type {
  InteractionCallback,
  InteractionCallbackParam,
  InteractionCallbackPreviews,
  InteractionParamType
} from '../types';

/**
 * The same declaration, read by the panel a person fills in.
 *
 * A source used to declare its params twice: once in the React component, for the editor, and once in a catalog
 * somewhere else, for whatever validates a step. The two drifted exactly as you would expect — a catalog claiming
 * `authLogin` takes no params while the source offered four, an action callback the catalog had never heard of —
 * and neither copy was wrong about itself, which is why nothing ever reported it. This is the one declaration, and
 * these are the two readings of it.
 */

const BUILDER_TYPES: Record<BuiltinParam['type'], InteractionParamType> = {
  text: 'text',
  textarea: 'textarea',
  select: 'select',
  boolean: 'boolean',
  // Neither has a control of its own: the editor writes numbers into a text box and coerces on the way out, and a
  // polymorphic value is a text box until the param above it says otherwise.
  number: 'text',
  scalar: 'text'
};

/** `autoDismissTimeout` → "Auto Dismiss Timeout", `top-right` → "Top Right". */
const humanize = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');

const toBuilderParam = (name: string, param: BuiltinParam): InteractionCallbackParam =>
  ({
    type: param.builderType ?? BUILDER_TYPES[param.type],
    label: param.label ?? humanize(name),
    ...(param.default === undefined ? {} : { defaultValue: param.default }),
    ...(param.options
      ? { options: param.options.map(value => ({ value, label: param.optionLabels?.[value] ?? humanize(value) })) }
      : {}),
    ...(param.when ? { when: param.when } : {}),
    ...(param.canBind === undefined ? {} : { canBind: param.canBind })
  }) as InteractionCallbackParam;

export const toBuilderParams = (spec: ParamSpec): Record<string, InteractionCallbackParam> =>
  Object.fromEntries(Object.entries(spec).map(([name, param]) => [name, toBuilderParam(name, param)]));

/** What a declared action carries, whichever kind of action it is. */
export interface BuiltinActionSpec {
  title: string;
  /** When true the param set is CLOSED: a key not listed is a mistake, dropped on apply and warned in validation. */
  strictParams: boolean;
  params: ParamSpec;
  /** The shape of what the step puts in the flow scope, so a later step can be written against it. */
  preview?: InteractionCallbackPreviews;
}

/**
 * A declared action, ready for `useInteractions` — everything but the function that runs it, which is the only
 * part a source has to write.
 */
export const toInteractionCallback = <T extends Record<string, unknown> = Record<string, unknown>>(
  action: string,
  spec: BuiltinActionSpec,
  callback: InteractionCallback<T>['callback'],
  overrides: Partial<InteractionCallback<T>> = {}
): InteractionCallback<T> =>
  ({
    action,
    title: spec.title,
    type: 'globalCallback',
    callback,
    preview: spec.preview ?? {},
    params: toBuilderParams(spec.params),
    ...overrides
  }) as InteractionCallback<T>;
