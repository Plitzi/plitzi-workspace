import type { DisplayMode, StyleObject, StyleValue } from '@plitzi/sdk-shared';

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

/** Per-breakpoint CSS as an author writes it. Omitted breakpoints inherit, as they do in the builder. */
export type ResponsiveCss = Partial<Record<DisplayMode, CssProps>>;

/** Per-breakpoint CSS as it reaches the document. */
export type ResponsiveStyle = Partial<Record<DisplayMode, StyleRules>>;
