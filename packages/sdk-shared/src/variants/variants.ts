import type { Element, Schema } from '../types';

/**
 * The element that shows each visitor one of its variants — chosen by chance (an A/B test: each variant a share of the
 * visitors, a visitor kept on theirs) or by rules (who the visitor is: the first variant whose rule they match).
 */
export const VARIANTS_TYPE = 'variants';

/** Its parts, in order: each with its share (`weight`) for the chance and its rule (`when`) for the rules. */
export const VARIANT_ITEM_TYPE = 'variantItem';

/** How a `variants` element chooses: at random by the variants' shares, or by the visitor's facts. */
export const CHOOSE_BY = ['chance', 'rules'] as const;

export type ChooseBy = (typeof CHOOSE_BY)[number];

export const isChooseBy = (value: unknown): value is ChooseBy => CHOOSE_BY.some(mode => mode === value);

/** What a `variants` element chooses by: chance, unless it says rules. */
export const chooseByOf = (attributes: Element['attributes']): ChooseBy =>
  isChooseBy(attributes.chooseBy) ? attributes.chooseBy : 'chance';

/** A `variants` element's variants, in order: its items of the variant type. */
export const variantItemsOf = (element: Element, flat: Schema['flat']): Element[] =>
  (element.definition.items ?? [])
    .filter(id => Object.hasOwn(flat, id) && flat[id].definition.type === VARIANT_ITEM_TYPE)
    .map(id => flat[id]);

/** The place (from 0) of the variant the builder's canvas shows while editing: one it has, the first otherwise. */
export const builderVariantOf = (attributes: Element['attributes'], count: number): number => {
  const { builderVariant } = attributes;

  return typeof builderVariant === 'number' &&
    Number.isInteger(builderVariant) &&
    builderVariant >= 0 &&
    builderVariant < count
    ? builderVariant
    : 0;
};

/** Every `variants` element of a space — its pages' tree and each component's — with the tree it is in. */
export const variantsElementsOf = (
  schema: Pick<Schema, 'flat'> & Partial<Pick<Schema, 'components'>>
): { element: Element; flat: Schema['flat'] }[] =>
  [schema.flat, ...Object.values(schema.components ?? {}).map(component => component.flat)].flatMap(flat =>
    Object.values(flat)
      .filter(element => element.definition.type === VARIANTS_TYPE)
      .map(element => ({ element, flat }))
  );
