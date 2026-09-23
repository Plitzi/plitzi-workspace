import type { DisplayMode, StyleBlock, StyleObject, StyleState, StyleValue } from '@plitzi/sdk-shared';

/**
 * The two shapes CSS has while a space is being authored.
 *
 * `CssProps` is what a person or an agent writes: kebab-case CSS with shorthands allowed. `StyleRules` is what
 * reaches the document, and the difference is not cosmetic — Plitzi's style editor reads a closed list of ~196
 * longhand properties, so a `padding` or a `gap` that survives to persistence renders correctly and then cannot be
 * read back, edited or overridden per breakpoint. Everything the authoring surface accepts is expanded and checked
 * against that list before it is written.
 */

/** What an author writes: kebab-case CSS, shorthands allowed, one value per key. */
export type CssProps = Record<string, StyleValue>;

/** The patch flavour of {@link CssProps}: `null` clears every longhand the key controls. */
export type CssPatch = Record<string, StyleValue | null>;

/** What reaches the document: expanded longhands, in the vocabulary the style editor understands. */
export type StyleRules = StyleObject;

/**
 * Per-breakpoint CSS as an author writes it. Omitted breakpoints inherit `desktop`, as they do in the builder — and
 * only `desktop`: `tablet` (48–64rem) and `mobile` (below 48rem) are disjoint ranges, so a `tablet` rule never
 * reaches a phone unless `mobile` repeats it.
 *
 * `compact` is both of them at once — everything narrower than a desktop: the dock that replaces a sidebar, the grid
 * that drops to one column. Written out to `tablet` and `mobile` alike, under whatever either says for itself, so
 * the document still holds the three breakpoints the builder edits.
 */
export type ResponsiveCss = Partial<Record<DisplayMode | 'compact', CssProps>>;

/** Per-breakpoint CSS as it reaches the document. */
export type ResponsiveStyle = Partial<Record<DisplayMode, StyleRules>>;

/**
 * CSS for one element or class, in either of the two shapes an author writes it in.
 *
 * Told apart by the keys, which is unambiguous rather than clever: `desktop`, `tablet` and `mobile` are not CSS
 * properties and never will be, so a rule set that mentions one is per-breakpoint and one that does not is the
 * desktop rules.
 */
export type CssSpec = CssProps | ResponsiveCss;

/** Rules for the states a selector reacts to — `hover`, `focus`, `active` — each one plain or per breakpoint. */
export type StatesSpec = Partial<Record<StyleState, CssSpec>>;

/** One variant of a selector: what it changes, and how it reacts on its own. A variant cannot carry variants. */
export interface VariantSpec {
  css?: CssSpec;
  states?: StatesSpec;
}

/**
 * Everything one selector can say, where plain CSS is not enough.
 *
 * `:hover` and the variants are not separate classes in Plitzi — they are parts of the SAME selector, which is what
 * the style editor shows as tabs of one class. Writing them as a second class (`.card:hover` in `customCss`) renders,
 * and then cannot be read back or overridden per breakpoint, so they are declared beside the rules they modify.
 */
export interface RuleSetSpec extends VariantSpec {
  /** By name — what `data-variant` and an element's `variant` select. Plain CSS, or CSS with states of its own. */
  variants?: Record<string, CssSpec | VariantSpec>;
  /**
   * How this selector looks inside an ANCESTOR, keyed by a class that ancestor wears: always (`css` — the shared icon
   * that is smaller inside a toolbar), or while the ancestor is in a state or variant (a card's hover moving its
   * icon, a collapsed sidebar hiding its labels). Any ancestor counts, not only the parent. Name the
   * class by its declaration — `[card.name]: { states: { hover: … } }` — so a rename reaches it.
   *
   * The selector's own states and variants win over these where both set a property.
   */
  ancestors?: Record<string, AncestorSpec>;
}

/** What one ancestor condition changes: inside it always, in its states, or in its variants (and their states). */
export interface AncestorSpec {
  css?: CssSpec;
  states?: StatesSpec;
  variants?: Record<string, CssSpec | VariantSpec>;
}

/** A selector's rules in either shape: plain CSS, or CSS with its states and variants beside it. */
export type StyleSpec = CssSpec | RuleSetSpec;

/** A selector's whole block per breakpoint, as it reaches the document. */
export type ResponsiveBlock = Partial<Record<DisplayMode, StyleBlock>>;

/**
 * A named rule set — a class — as opposed to an anonymous one.
 *
 * `css` and the layout helpers produce rules that belong to whoever asked for them. This is the other kind: rules
 * with a name, so more than one element can point at the same ones and a change to them is a change to all. The
 * rules are normalised when the declaration is made, so an unwritable property is an error on the line that wrote
 * it rather than wherever the class is later used.
 */
export interface StyleDeclaration {
  readonly name: string;
  readonly rules: ResponsiveBlock;
  toString(): string;
}

/** A class by name, or a `styles()` declaration that brings its rules along. */
export type ClassRef = string | StyleDeclaration;

/**
 * The classes a selector wears: one, or several.
 *
 * Several is what the builder writes when an element carries a shared base and a modifier — `panel-card quota-panel`
 * — and the SDK applies all of them, in the order the stylesheet declares them rather than the order listed here.
 */
export type ClassList = ClassRef | readonly ClassRef[];
