import type { Element, Style, StyleBlock, StyleObject, StyleStates } from '@plitzi/sdk-shared';

const hasDeclarations = (object: StyleObject | undefined): boolean => Object.keys(object ?? {}).length > 0;

const statesHaveRules = (states: StyleStates | undefined): boolean => Object.values(states ?? {}).some(hasDeclarations);

const blockHasRules = (block: StyleBlock): boolean =>
  hasDeclarations(block.default) ||
  statesHaveRules(block.states) ||
  Object.values(block.variants ?? {}).some(
    variant => hasDeclarations(variant.default) || statesHaveRules(variant.states)
  );

/** Whether a class carries any rule, at any breakpoint — a class name alone styles nothing. */
const classHasRules = (style: Pick<Style, 'platform'>, name: string): boolean =>
  Object.values(style.platform).some(
    breakpoint => Object.hasOwn(breakpoint, name) && Object.values(breakpoint[name].attributes).some(blockHasRules)
  );

/**
 * Whether an element renders no element of its own — an `apiContainer` with no `subType`, the builder's "Container
 * Tag: None". Its children sit straight in its parent, so it has no box: nothing to style, and nothing a test can see.
 */
export const rendersNoTag = (element: Pick<Element, 'attributes' | 'definition'>): boolean => {
  const subType: unknown = element.attributes.subType;

  return element.definition.type === 'apiContainer' && (typeof subType !== 'string' || subType === '');
};

/**
 * Why an element's style applies to nothing, if it does not.
 *
 * An `apiContainer` whose `subType` is empty — its default, the builder's "Container Tag: None" — renders its
 * children and no element of its own, so a class with rules, a variant or a style binding on it styles nothing: its
 * children sit straight in the parent's layout, and the gap or padding written on the provider is not there. Found on
 * real spaces as a counter card with no card, a sticky sidebar that did not stick, and page sections that lost the
 * gap between them.
 *
 * Needs the style document: the builder and the authoring package both give every element a class of its own, rules
 * or not, so a class name on its own says nothing. A provider with no tag is legal and often right.
 */
export const styleWithoutTag = (element: Element, style: Pick<Style, 'platform'>): string | undefined => {
  if (!rendersNoTag(element)) {
    return undefined;
  }

  const { styleSelectors, initialState, bindings } = element.definition;
  const hasRules = Object.values(styleSelectors).some(names =>
    names.split(' ').some(name => name && classHasRules(style, name))
  );
  const hasVariant = Object.keys(initialState?.styleVariant ?? {}).length > 0;
  const hasStyleBinding = (bindings?.style?.length ?? 0) > 0;
  if (!hasRules && !hasVariant && !hasStyleBinding) {
    return undefined;
  }

  return (
    'has style but no `subType` (container tag), so it renders no element of its own and the style applies to ' +
    'nothing — its children lay out in its parent. Give it a tag (a `subType` of `div`, `section`, …) or move the ' +
    'style onto its parent or a child.'
  );
};
