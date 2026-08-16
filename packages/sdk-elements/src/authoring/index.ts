import { elementDeclarations } from '../elements/declarations';

import type { ElementDeclarationName } from '../elements/declarations';
import type { ElementSpec, ResponsiveStyle } from '@plitzi/sdk-schema';

/**
 * Authoring elements offline, from what each element already says about itself.
 *
 * `@plitzi/sdk-schema` builds a space out of `ElementSpec`s but knows nothing about element types, and it must not:
 * a table of hand-written factories over there is duplicated knowledge that silently falls behind every time an
 * element is added. So the factory lives here, with the elements, and reads their own declarations — which means a
 * new element becomes authorable the moment it declares itself, with nothing added to this file.
 *
 * It reads declarations rather than components on purpose. The components cannot be imported outside a browser (an
 * element and the catalogue reference each other, so the import throws at module init), and a seed or a migration
 * has no use for a React component anyway.
 */

export type { ElementDeclarationName };

/** What the factory needs from a declaration. Anything else on it stays the element's business. */
export interface ElementDeclaration {
  type: string;
  content?: {
    attributes?: Record<string, unknown>;
    definition?: { label?: string };
  };
}

export type ElementOverrides = Omit<ElementSpec, 'type'>;

/**
 * The element's own defaults, with the author's values on top.
 *
 * Attributes merge rather than replace: a declaration's `content.attributes` is what the element needs to render at
 * all — a heading's `subType`, a list's `source` — and dropping them because the author only wanted to set the text
 * is how an authored element ends up subtly unlike one the builder created.
 */
export const elementSpec = (declaration: ElementDeclaration, overrides: ElementOverrides = {}): ElementSpec => ({
  type: declaration.type,
  label: overrides.label ?? declaration.content?.definition?.label ?? declaration.type,
  ...overrides,
  attributes: { ...declaration.content?.attributes, ...overrides.attributes }
});

/** The same, by the element's name in the catalogue: `element('Heading', { attributes: { content: 'Hi' } })`. */
export const element = (name: ElementDeclarationName, overrides: ElementOverrides = {}): ElementSpec =>
  elementSpec(elementDeclarations[name], overrides);

/**
 * Curried, for authoring many of one type.
 *
 * `children` and `style` are named separately because they are what actually varies from one call to the next, and
 * threading them through `overrides` every time is what made the old shorthands look like a DSL.
 */
export const authorable =
  (name: ElementDeclarationName) =>
  (overrides: ElementOverrides = {}, style?: ResponsiveStyle, children?: ElementSpec[]): ElementSpec =>
    element(name, {
      ...overrides,
      ...(style ? { style } : {}),
      ...(children ? { children } : {})
    });
