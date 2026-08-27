import type {
  InteractionCallback,
  InteractionCallbackContext,
  InteractionCallbackParam,
  InteractionCallbackPreviews,
  InteractionCallbackType,
  InteractionParamType
} from '@plitzi/sdk-shared';
import type { BuiltinParam, ParamSpec } from '@plitzi/sdk-shared/authoring';

/**
 * The same declaration, read by the panel a person fills in.
 *
 * Here rather than beside the param shape it converts: what comes out is an `InteractionCallback`, which is what
 * `useInteractions` — this package's own registration API — consumes. The SHAPE of a declared param is shared
 * vocabulary and lives in `@plitzi/sdk-shared` because four catalogs in three packages are written against it;
 * an adapter onto one package's registration API is not shared vocabulary, whatever the type it names.
 *
 * A source used to declare its params twice: once in the React component, for the editor, and once in a catalog
 * somewhere else, for whatever validates a step. The two drifted exactly as you would expect — a catalog claiming
 * `login` takes no params while the source offered four, an action callback the catalog had never heard of —
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
  /**
   * What KIND of node this action produces, which is also how the runtime resolves it: a `globalCallback` is
   * looked up under its source module, a `callback` under an element's idRef, a `utility` under nothing at all.
   * A global callback is the common case and the default.
   */
  type?: InteractionCallbackType;
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
    type: spec.type ?? 'globalCallback',
    callback,
    preview: spec.preview ?? {},
    params: toBuilderParams(spec.params),
    ...overrides
  }) as InteractionCallback<T>;

/**
 * Every declared action of one source, ready for `useInteractions`.
 *
 * The reason to build the whole map rather than call {@link toInteractionCallback} per entry: the key a callback is
 * registered under IS the name a document names it by, and writing that key by hand beside a catalog that also
 * names it is two strings that have to agree with nothing checking. They stopped agreeing for all three of the auth
 * callbacks — declared `authLogin`, registered `login` — and the only symptom was a sign-in button that did
 * nothing at all.
 *
 * Here the key comes from the catalog, and `handlers` is checked against the same keys, so a renamed action is a
 * compile error and an unimplemented one cannot be registered.
 */
export const toInteractionCallbacks = <C extends Record<string, BuiltinActionSpec>>(
  catalog: C,
  // `never` for the params so a source may type its own handler against the params it declared: the runtime hands
  // every callback the node's values as a plain record, and each source knows the shape it asked for.
  handlers: { [K in keyof C]: (params: never, context?: InteractionCallbackContext) => unknown },
  overrides: { [K in keyof C]?: Partial<InteractionCallback> } = {}
): Record<string, InteractionCallback> =>
  Object.fromEntries(
    Object.keys(catalog).map(action => [
      action,
      toInteractionCallback(
        action,
        catalog[action],
        // The one cast this indirection costs, and it buys the removal of the same cast from every source.
        handlers[action] as InteractionCallback['callback'],
        overrides[action] ?? {}
      )
    ])
  );
