import { isInstance } from '@plitzi/sdk-schema';
import { resolveLayoutChain } from '@plitzi/sdk-shared/schema';
import { rootName } from '@pmodules/Builder/helpers/searchElements';

import type { Element, Schema, SpaceComponent, Style } from '@plitzi/sdk-shared';

/** One place a component is drawn: its instance, and the page, layout or component it is in, by name. */
export type ComponentPlacement = { instanceId: string; where: string };

/**
 * What a component is drawn on where it is placed — the nearest background and text colour around an instance — so
 * the canvas shows it as its instance is seen. A card made for a dark section has white words: on the canvas's own
 * white it was a blank canvas.
 */
export type ComponentGround = { background?: string; color?: string };

/** What a component is shown with while it is edited or previewed: its props' values, and the ground under it. */
export type ComponentPreview = { props: Record<string, unknown>; ground: ComponentGround };

const BACKGROUNDS = ['background-color', 'background-image', 'background'];

/** Each tree an instance can be in: the pages and layouts of `schema.flat`, and each component's own. */
const treesOf = (schema: Pick<Schema, 'flat' | 'components'>): { flat: Record<string, Element> }[] => [
  { flat: schema.flat },
  ...Object.values(schema.components)
];

/** Every place a component is drawn, in the order the document holds them. */
export const placementsOf = (schema: Pick<Schema, 'flat' | 'components'>, componentId: string): ComponentPlacement[] =>
  treesOf(schema).flatMap(({ flat }) =>
    Object.values(flat)
      .filter(element => isInstance(element, componentId))
      .map(element => ({ instanceId: element.id, where: rootName(flat, element.definition.rootId) }))
  );

/** A value a rule paints with, or nothing for one that paints nothing (`transparent`, `none`, unset). */
const painted = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' && !/^(transparent|none|initial|unset|inherit)$/.test(value.trim())
    ? value
    : undefined;

/** What an element's classes set of `properties` on a desktop, the first of them that paints. */
const ruleOf = (element: Element, style: Pick<Style, 'platform'>, properties: string[]): string | undefined => {
  const { desktop } = style.platform;
  for (const name of element.definition.styleSelectors.base.split(/\s+/).filter(Boolean)) {
    const rules = Object.hasOwn(desktop, name) ? desktop[name].attributes.base.default : undefined;
    // The document keys a rule set by its CSS property names: read as a plain record to ask for one by name.
    const record: Record<string, unknown> = { ...rules };
    const found = properties.map(property => painted(record[property])).find(value => value !== undefined);
    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
};

/**
 * The nearest background and text colour around an element: its ancestors up to the root of its tree, and — a page
 * being drawn inside its layouts — each layout's slot the page sits in and that slot's ancestors, innermost first. The
 * dashboard's ground is its layout's, not any page's.
 */
const groundOf = (flat: Record<string, Element>, element: Element, style: Pick<Style, 'platform'>): ComponentGround => {
  const ground: ComponentGround = {};
  const climb = (from: Element | undefined): void => {
    let current = from;
    while (current && (ground.background === undefined || ground.color === undefined)) {
      ground.background ??= ruleOf(current, style, BACKGROUNDS);
      ground.color ??= ruleOf(current, style, ['color']);
      current = current.definition.parentId ? flat[current.definition.parentId] : undefined;
    }
  };

  climb(element.definition.parentId ? flat[element.definition.parentId] : undefined);
  const page = flat[element.definition.rootId] as Element | undefined;
  const text = (key: string): string => (typeof page?.attributes[key] === 'string' ? page.attributes[key] : '');
  for (const link of resolveLayoutChain(id => flat[id], text('layout'), text('layoutContainer'))) {
    climb(flat[link.slot]);
  }

  return ground;
};

/** What a component's props read with no instance around it: each one's default, or nothing. */
const defaultsOf = (component: SpaceComponent): Record<string, unknown> =>
  Object.fromEntries(Object.entries(component.props ?? {}).map(([name, prop]) => [name, prop.default ?? null]));

/**
 * A component as one of its instances shows it: the props that instance writes (a bound one is the page's to resolve,
 * and keeps its default) over the defaults, and the ground around it. With no instance — none placed, or the one asked
 * for gone — the defaults alone, on the canvas's own ground.
 */
export const previewOf = (
  schema: Pick<Schema, 'flat' | 'components'>,
  style: Pick<Style, 'platform'>,
  component: SpaceComponent,
  instanceId?: string
): ComponentPreview => {
  const defaults = defaultsOf(component);
  const placed = treesOf(schema)
    .map(({ flat }) => ({ flat, element: instanceId === undefined ? undefined : flat[instanceId] }))
    .find(({ element }) => element !== undefined && isInstance(element, component.id));
  const tree =
    placed ??
    treesOf(schema)
      .map(({ flat }) => ({ flat, element: Object.values(flat).find(element => isInstance(element, component.id)) }))
      .find(({ element }) => element !== undefined);
  if (!tree?.element) {
    return { props: defaults, ground: {} };
  }

  const { attributes, definition } = tree.element;
  const bound = new Set((definition.bindings?.attributes ?? []).map(binding => binding.to));
  const written = Object.fromEntries(
    Object.keys(defaults).flatMap(name =>
      Object.hasOwn(attributes, name) && attributes[name] !== undefined && !bound.has(name)
        ? [[name, attributes[name]]]
        : []
    )
  );

  return { props: { ...defaults, ...written }, ground: groundOf(tree.flat, tree.element, style) };
};
