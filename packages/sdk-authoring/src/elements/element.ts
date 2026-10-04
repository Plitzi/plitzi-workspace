import { elementDeclarations } from '@plitzi/sdk-elements/elements/declarations';

import { scoped } from './scope';
import { isSourcePath, sourceName } from './source';
import { toBindingSpecs } from '../schema/bindings';
import { AuthoringError } from '../schema/codes';
import { MAIN_ATTRIBUTES } from '../schema/mainAttributes';
import { markWrittenAt } from '../schema/writtenAt';

import type { BindingSpec, BindingsSpec, ElementSpec, SpecMeta, StepSpec, VisibleCondition } from '../schema';
import type { SourceName } from './source';
import type { ClassList, CssSpec, ElementClassList, StatesSpec } from '../style';
import type { ElementLoadStrategy, ElementRuntime } from '@plitzi/sdk-shared';
import type {
  AttributesOf,
  ElementAttributesBrand,
  ElementDeclarationData
} from '@plitzi/sdk-shared/authoring/declare';
import type { ElementMotion } from '@plitzi/sdk-shared/schema/motion';

/**
 * Authoring an element.
 *
 * Attributes and the handful of authoring fields go in one flat object, because that is how a person writing a
 * page thinks about it: `heading({ content: 'Hi', subType: 'h2', class: 'title' })` rather than a wrapper around a
 * wrapper. Nothing collides — no element in the catalogue has an attribute called `class`, `css`, `children`,
 * `bind` or any of the others, and the one name that does overlap something (`label`, which a link and a form
 * control both carry) belongs to the attribute, because that is the one an author means. The builder's own name
 * for the element is `meta.label`, and it is the rare one.
 *
 * A factory returns an `ElementSpec` and nothing more: specs are inert until `authorSpace` writes them, which is
 * what keeps every guarantee about the finished document in one place.
 */

export interface AuthoringProps {
  /**
   * The one name this element answers to — its key in the document, a binding's source, a step's target. Derived
   * when left out, positionally, so name the ones something else refers to.
   */
  id?: string;
  /**
   * A shared class — a name from the space's `classes`, or a `styles()` declaration — or a list of them, which may end
   * with rules of this element's own on top: `[cover, { opacity: '0.25' }]`. Exclusive with {@link AuthoringProps.css}.
   */
  class?: ElementClassList;
  /** Rules of this element's own: one set, or one per breakpoint. Shorthands are expanded when the space is written. */
  css?: CssSpec;
  /** How the element's own rules react — `hover`, `focus` — beside {@link AuthoringProps.css}. */
  states?: StatesSpec;
  /** The name of the element's own selector; derived from where it sits when left out. */
  selector?: string;
  /** Style variant of the element's own vocabulary, e.g. a heading's `title`. */
  variant?: string;
  /** A class for one of the element's other selectors — a form control's `input`, `label`, `error`. */
  slots?: Record<string, ClassList>;
  /** `{ content: 'posts.title' }`, or the full form for state, transformers and conditions. */
  bind?: BindingsInput;
  /** The source the element's main attribute shows — see {@link ElementSpec.from}. */
  from?: SourceName;
  /** How `from` is shown: a name of the space's `formats`, or a template of its own. */
  as?: string;
  /**
   * A list's row — what it renders once per item: a component's id, placed with the row bound to its `item` prop, or
   * a function handed the row's names (`r.item`, `r.index`, and `r.inTemplate` for a template) returning the elements.
   */
  row?: string | RowWriter<ListRow>;
  /**
   * Show this element only while the value at this source is true. `!source` shows it while the value is false,
   * `{ source, template }` while a template over it says `true`, and `false` starts it hidden for a flow to reveal.
   */
  visible?: SourceName | false | VisibleInput;
  /** One flow per entry; steps are chained in the order written. */
  flows?: StepSpec[][];
  /** `server` resolves this element's data on the server rather than in the browser. */
  runtime?: ElementRuntime;
  /** When the element's contents mount relative to its visibility. Left out, the element type decides. */
  loadStrategy?: ElementLoadStrategy;
  /** Its `id` in the DOM, so `/page#anchor` lands on it. One per page; not inside a list row or a component. */
  anchor?: string;
  /** How it arrives and whether it keeps moving: `{ enter: 'fade-up', on: 'view' }`. Played by the SDK's stylesheet. */
  motion?: ElementMotion;
  /** The feature flag it exists under: `'newCheckout'` while on, `'!newCheckout'` while off. Not a visibility. */
  flag?: string;
  children?: ElementSpec[];
  /** What the builder shows, not what the runtime reads. */
  meta?: SpecMeta;
}

/** A visibility condition whose source may be a typed source's path as well as a name. */
export type VisibleInput = Omit<VisibleCondition, 'source'> & { source: SourceName };

const visibleOf = (visible: SourceName | false | VisibleInput): string | false | VisibleCondition => {
  if (visible === false || typeof visible === 'string') {
    return visible;
  }

  if (isSourcePath(visible)) {
    return sourceName(visible);
  }

  return { ...visible, source: sourceName(visible.source) };
};

/** What a list's `row` function is: handed the row's names, it writes what the row renders. */
export type RowWriter<Row> = (row: Row) => ElementSpec | ElementSpec[];

/** A binding whose source may be a typed source's path as well as a name. */
export type BindingsInput = Record<string, SourceName> | (Omit<BindingSpec, 'source'> & { source: SourceName })[];

const bindingsOf = (bind: BindingsInput): BindingsSpec =>
  Array.isArray(bind)
    ? bind.map(binding => ({ ...binding, source: sourceName(binding.source) }))
    : Object.fromEntries(Object.entries(bind).map(([to, source]) => [to, sourceName(source)]));

/** Attributes and authoring fields, flat. Attributes win a name they share with anything here. */
export type ElementProps<A> = A & AuthoringProps;

type ContentShorthand<A> = 'content' extends keyof A
  ? { (content: string, props?: ElementProps<A>): ElementSpec }
  : unknown;

/**
 * The three ways to call a factory: props, children first, or — for anything with a `content` attribute — the
 * content itself, which is what most of a page is.
 */
export type ElementFactory<A> = ContentShorthand<A> & {
  (props?: ElementProps<A>): ElementSpec;
  (children: ElementSpec[], props?: ElementProps<A>): ElementSpec;
};

/** A target with a scheme of its own — `https:`, `mailto:`, `tel:` — is somewhere outside the space. */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * What a link's `href` says it is when the author did not say: a path is a route of this space, a URL is somewhere
 * else, anything else is a page's id. `mode` stays for the rare link that means otherwise.
 */
export const inferredLinkMode = (href: unknown): 'page' | 'internal' | 'external' => {
  if (typeof href !== 'string') {
    return 'page';
  }

  if (SCHEME.test(href) || href.startsWith('//')) {
    return 'external';
  }

  return href.startsWith('/') ? 'internal' : 'page';
};

/**
 * The main attribute empty, for an element whose content comes from its data: its default ("Text", "Button") would
 * show until the data answers.
 */
const unfilled = (type: string, attributes: Record<string, unknown>): Record<string, unknown> => {
  const main = Object.hasOwn(MAIN_ATTRIBUTES, type) ? MAIN_ATTRIBUTES[type] : undefined;
  if (!main || Object.hasOwn(attributes, main)) {
    return {};
  }

  return { [main]: main === 'items' ? [] : '' };
};

/** Attributes a type works out from the others, when the author left them out — written as if they had been. */
const inferred = (type: string, attributes: Record<string, unknown>): Record<string, unknown> =>
  type === 'link' && !Object.hasOwn(attributes, 'mode') ? { mode: inferredLinkMode(attributes.href) } : {};

/** A list's row by its names: short in a binding or `from`, spelled in full in a template or an attribute's token. */
export interface ListRow {
  /** The list's own name, as the space knows it. */
  list: string;
  /** The source its rows publish, in full: `list_rows`, `carousel_hero`. */
  source: string;
  /** The row's item: `rows.item`, and a field of it `` `${r.item}.title` ``. */
  item: string;
  /** Its position: `rows.index`. */
  index: string;
  /** The same names in full, for a template or an attribute token: `{{ list_rows.item.slug }}`. */
  inTemplate: { item: string; index: string };
}

/** What repeats its children once per item: a list, and a carousel's slides. */
type Repeater = 'list' | 'carousel';

const listRow = (id: string, kind: Repeater): ListRow => ({
  list: id,
  source: `${kind}_${id}`,
  item: `${id}.item`,
  index: `${id}.index`,
  inTemplate: { item: `${kind}_${id}.item`, index: `${kind}_${id}.index` }
});

/**
 * A list as it reads shortest: `items` or `from` makes it controlled — an array of its own, or a source's name, bound — and a
 * `row` function writes its children with the row's names in hand. A row that names a component is the space's to
 * resolve, which knows the component's props.
 */
const listShape = (
  kind: Repeater,
  id: string | undefined,
  attributes: Record<string, unknown>,
  bind: BindingsSpec | undefined,
  row: AuthoringProps['row'],
  children: ElementSpec[] | undefined,
  fed: boolean
): { attributes: Record<string, unknown>; bind?: BindingsSpec; children?: ElementSpec[]; row?: string } => {
  const { items, ...rest } = attributes;
  const sourced = typeof items === 'string' || isSourcePath(items);
  const shaped = {
    attributes: {
      ...rest,
      ...(items === undefined || sourced ? {} : { items }),
      ...(kind === 'list' && (items !== undefined || fed) && !Object.hasOwn(attributes, 'source')
        ? { source: 'controlled' }
        : {})
    },
    ...(sourced
      ? { bind: [...(bind === undefined ? [] : toBindingSpecs(bind)), { to: 'items', source: sourceName(items) }] }
      : bind === undefined
        ? {}
        : { bind })
  };
  if (row === undefined) {
    return { ...shaped, ...(children === undefined ? {} : { children }) };
  }

  // A carousel's other children are its controls, beside the track its slides go in; a list's row IS its children.
  if (kind === 'list' && children !== undefined) {
    throw new AuthoringError(
      'row-and-children',
      'A list with a `row` takes no `children`: the row IS what it renders.'
    );
  }

  if (typeof row === 'string') {
    return { ...shaped, row, ...(children === undefined ? {} : { children }) };
  }

  if (id === undefined) {
    throw new AuthoringError(
      'row-without-id',
      `A ${kind} whose \`row\` is a function needs an \`id\`, which names the sources of its rows: give the ${kind} one.`
    );
  }

  const written = row(listRow(id, kind));
  const rows = Array.isArray(written) ? written : [written];
  if (kind === 'list') {
    return { ...shaped, children: rows };
  }

  const track = callFactory('carouselTrack', declarationsByType.get('carouselTrack'), { children: rows });

  return { ...shaped, children: [track, ...(children ?? [])] };
};

const buildSpec = (
  type: string,
  declaration: ElementDeclarationData | undefined,
  props: ElementProps<Record<string, unknown>>
): ElementSpec => {
  // The authoring fields, named once. Everything left over is an attribute — including `label`, which is why it
  // is not in this list.
  const {
    id: givenId,
    class: shared,
    css,
    states,
    selector,
    variant,
    slots,
    bind: givenBind,
    from: givenFrom,
    as,
    row,
    visible: givenVisible,
    flows,
    runtime,
    loadStrategy,
    anchor,
    motion,
    flag,
    children,
    meta,
    ...attributes
  } = props;
  const id = givenId === undefined ? undefined : scoped(givenId);
  const bind = givenBind === undefined ? undefined : bindingsOf(givenBind);
  const from = givenFrom === undefined ? undefined : sourceName(givenFrom);
  const visible = givenVisible === undefined ? undefined : visibleOf(givenVisible);

  const list =
    type === 'list' || type === 'carousel'
      ? listShape(type, id, attributes, bind, row, children, from !== undefined)
      : undefined;
  if (row !== undefined && !list) {
    throw new AuthoringError('row-outside-list', `A "${type}" has no rows: \`row\` is a list's or a carousel's.`);
  }

  return markWrittenAt({
    type,
    ...(id === undefined ? {} : { id }),
    ...(shared === undefined ? {} : { class: shared }),
    ...(css === undefined ? {} : { css }),
    ...(states === undefined ? {} : { states }),
    ...(selector === undefined ? {} : { selector }),
    ...(variant === undefined ? {} : { variant }),
    ...(slots === undefined ? {} : { slots }),
    ...(list ? (list.bind === undefined ? {} : { bind: list.bind }) : bind === undefined ? {} : { bind }),
    ...(list?.row === undefined ? {} : { row: list.row }),
    ...(from === undefined ? {} : { from }),
    ...(as === undefined ? {} : { as }),
    ...(visible === undefined ? {} : { visible }),
    ...(flows === undefined ? {} : { flows }),
    ...(runtime === undefined ? {} : { runtime }),
    ...(loadStrategy === undefined ? {} : { loadStrategy }),
    ...(anchor === undefined ? {} : { anchor }),
    ...(motion === undefined ? {} : { motion }),
    ...(flag === undefined ? {} : { flag }),
    ...(list
      ? list.children === undefined
        ? {}
        : { children: list.children }
      : children === undefined
        ? {}
        : { children }),
    // The element's own defaults, with the author's values on top. Attributes MERGE rather than replace: a
    // declaration's defaults are what the element needs to render at all — a heading's `subType`, a list's
    // `source` — and dropping them because the author only set the text is how an authored element ends up
    // subtly unlike one the builder created.
    attributes: {
      ...declaration?.content?.attributes,
      ...inferred(type, attributes),
      ...(from === undefined ? {} : unfilled(type, attributes)),
      ...(list ? list.attributes : attributes)
    },
    meta: { label: declaration?.content?.definition?.label ?? type, ...meta }
  });
};

const callFactory = (
  type: string,
  declaration: ElementDeclarationData | undefined,
  first?: unknown,
  second?: unknown
): ElementSpec => {
  const props = (second ?? {}) as ElementProps<Record<string, unknown>>;

  if (typeof first === 'string') {
    return buildSpec(type, declaration, { content: first, ...props });
  }

  if (Array.isArray(first)) {
    return buildSpec(type, declaration, { children: first as ElementSpec[], ...props });
  }

  return buildSpec(type, declaration, (first ?? {}) as ElementProps<Record<string, unknown>>);
};

/**
 * A typed factory for one element type.
 *
 * Handed a branded declaration it reads the attributes off it, which is how every built-in factory is made. Handed
 * anything else — a plugin's `pluginSchema` entry, a type a deployment ships itself — the attributes are whatever
 * the caller says they are, and nothing is claimed that is not known.
 */
export const defineElement =
  <A = Record<string, unknown>>(
    declaration: ElementDeclarationData & Partial<ElementAttributesBrand<A>>
  ): ElementFactory<A> =>
  (first?: unknown, second?: unknown) =>
    callFactory(declaration.type, declaration, first, second);

const declarationsByType = new Map<string, ElementDeclarationData>(
  Object.values(elementDeclarations).map(declaration => [declaration.type, declaration])
);

/**
 * The attributes an element of this type starts with — what a factory merges under the author's own.
 *
 * An attribute equal to one of these says nothing a factory would not say for it, which is what lets a reader of a
 * document leave it out, and what makes "absent" and "the default" the same answer when two documents are compared.
 */
export const defaultAttributes = (type: string): Record<string, unknown> => ({
  ...declarationsByType.get(type)?.content?.attributes
});

/** The name a factory gives an element of this type in the builder's tree, unless the author gave it another. */
export const defaultLabel = (type: string): string => declarationsByType.get(type)?.content?.definition?.label ?? type;

type DeclarationByType = {
  [
    Name in keyof typeof elementDeclarations as (typeof elementDeclarations)[Name]['type']
  ]: (typeof elementDeclarations)[Name];
};

/** Every built-in element type, by the name a document stores — `heading`, `apiContainer`, `formControl`. */
export type ElementTypeName = keyof DeclarationByType;

type AttributesForType<T extends string> = T extends ElementTypeName
  ? AttributesOf<DeclarationByType[T]>
  : Record<string, unknown>;

/**
 * The attributes of one built-in element, by type name — `Attributes<'heading'>['subType']`.
 *
 * For the times a space declares a helper of its own around a factory and needs to say what it takes: without it
 * the argument widens to `string` and the six headings that exist stop being six.
 */
export type Attributes<T extends ElementTypeName> = AttributesForType<T>;

/**
 * One element by type name, for the times a factory is not what is wanted: a type this SDK does not ship, a type
 * chosen at runtime, a type a plugin brings.
 *
 * A built-in name types its own attributes and merges the element's defaults. Anything else is authored as
 * declared — `element<SpeciesAttributes>('speciesStatus', { … })` when the shape is known, plainly when it is not.
 */
export const element = <A extends object = never, T extends string = string>(
  type: T,
  props?: ElementProps<[A] extends [never] ? AttributesForType<T> : A>
): ElementSpec => buildSpec(type, declarationsByType.get(type), (props ?? {}) as ElementProps<Record<string, unknown>>);

/** How an instance is authored: what it hands in, what fills its slots, and the authoring fields any element takes. */
export type ComponentInstanceProps = Pick<
  AuthoringProps,
  'id' | 'class' | 'css' | 'states' | 'selector' | 'bind' | 'visible' | 'flows' | 'meta'
> & {
  /** The props the component declares, by name. A prop is an attribute of the instance: `bind` can land on one too. */
  props?: Record<string, unknown>;
  /** What fills the slots: a list, for a component with one slot, or one list per slot it declares. */
  children?: ElementSpec[] | Record<string, ElementSpec[]>;
};

/**
 * An instance of one of the space's components (`SpaceSpec.components`): the component's tree, rendered here with
 * these props.
 *
 * ```ts
 * component('product-card', { props: { title: 'Lamp' }, children: { 'product-card-actions': [button('Buy')] } })
 * ```
 *
 * Checked when the space is written: a component the space does not declare, a prop it does not declare, a required
 * one left out, a value of the wrong kind and a slot it does not have are each refused, by name.
 */
export const component = (componentId: string, instance: ComponentInstanceProps = {}): ElementSpec => {
  const { props, children, ...authoring } = instance;
  const filled = Array.isArray(children)
    ? children
    : Object.entries(children ?? {}).flatMap(([slot, specs]) =>
        specs.map(spec => ({ ...spec, attributes: { ...spec.attributes, slot } }))
      );
  const spec = buildSpec('reference', declarationsByType.get('reference'), {
    ...authoring,
    ...(filled.length > 0 ? { children: filled } : {})
  });

  // After the authoring fields are read, never among them: a prop called `bind` is the component's, not the binding's.
  return {
    ...spec,
    attributes: { ...spec.attributes, referenceType: 'component', referenceId: componentId, ...props }
  };
};
