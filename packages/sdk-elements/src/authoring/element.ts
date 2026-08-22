import { elementDeclarations } from '../elements/declarations';

import type { AttributesOf, ElementAttributesBrand, ElementDeclarationData } from './declare';
import type { BindingsSpec, CssSpec, ElementSpec, SpecMeta, StepSpec } from '@plitzi/sdk-schema';
import type { ElementRuntime } from '@plitzi/sdk-shared';

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
   * The name the rest of the space calls this element by — a binding's source, a step's target. Derived when left
   * out, positionally, so name the ones something else refers to.
   */
  idRef?: string;
  /** A shared class declared in the space's `classes`. Exclusive with {@link AuthoringProps.css}. */
  class?: string;
  /** Rules of this element's own: one set, or one per breakpoint. Shorthands are expanded when the space is written. */
  css?: CssSpec;
  /** Style variant of the element's own vocabulary, e.g. a heading's `title`. */
  variant?: string;
  /** A class for one of the element's other selectors — a form control's `input`, `label`, `error`. */
  slots?: Record<string, string>;
  /** `{ content: 'apiContainer_posts.title' }`, or the full form for state, transformers and conditions. */
  bind?: BindingsSpec;
  /** One flow per entry; steps are chained in the order written. */
  flows?: StepSpec[][];
  /** `server` resolves this element's data on the server rather than in the browser. */
  runtime?: ElementRuntime;
  children?: ElementSpec[];
  /** What the builder shows, not what the runtime reads. */
  meta?: SpecMeta;
}

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

const buildSpec = (
  type: string,
  declaration: ElementDeclarationData | undefined,
  props: ElementProps<Record<string, unknown>>
): ElementSpec => {
  // The authoring fields, named once. Everything left over is an attribute — including `label`, which is why it
  // is not in this list.
  const { idRef, class: shared, css, variant, slots, bind, flows, runtime, children, meta, ...attributes } = props;

  return {
    type,
    ...(idRef === undefined ? {} : { idRef }),
    ...(shared === undefined ? {} : { class: shared }),
    ...(css === undefined ? {} : { css }),
    ...(variant === undefined ? {} : { variant }),
    ...(slots === undefined ? {} : { slots }),
    ...(bind === undefined ? {} : { bind }),
    ...(flows === undefined ? {} : { flows }),
    ...(runtime === undefined ? {} : { runtime }),
    ...(children === undefined ? {} : { children }),
    // The element's own defaults, with the author's values on top. Attributes MERGE rather than replace: a
    // declaration's defaults are what the element needs to render at all — a heading's `subType`, a list's
    // `source` — and dropping them because the author only set the text is how an authored element ends up
    // subtly unlike one the builder created.
    attributes: { ...declaration?.content?.attributes, ...attributes },
    meta: { label: declaration?.content?.definition?.label ?? type, ...meta }
  };
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
