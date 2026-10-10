/** The class on a space's root element, where what floats above its page — a dropdown's open menu — is drawn. */
export const SPACE_ROOT_CLASS = 'plitzi-sdk';

/** The root of the space `node` is drawn in: the nearest one, for a space drawn inside another. */
export const spaceRootOf = (node: Element | null | undefined): HTMLElement | null =>
  node?.closest<HTMLElement>(`.${SPACE_ROOT_CLASS}`) ?? null;
