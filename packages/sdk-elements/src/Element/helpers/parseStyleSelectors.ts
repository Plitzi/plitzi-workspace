import type { Element } from '@plitzi/sdk-shared';

const parseStyleSelectors = (definition: Element['definition']) => {
  if (!definition.initialState?.styleVariant) {
    return definition.styleSelectors;
  }

  return Object.fromEntries(
    Object.entries(definition.styleSelectors).map(([styleSelector, selectors]) => {
      if (!selectors.includes(definition.type)) {
        // element global selector, we need to add the element type as a base selector
        if (selectors) {
          selectors = `${definition.type} ${selectors}`;
        } else {
          selectors = definition.type;
        }
      }

      const baseClass =
        styleSelector === 'base' ? `plitzi__${definition.type}` : `plitzi__${definition.type}-${styleSelector}`;

      if (typeof selectors !== 'string') {
        return [styleSelector, selectors];
      }

      const variants = definition.initialState?.styleVariant?.[styleSelector];
      let nextSelectors = selectors;
      if (variants) {
        const variantList = Array.isArray(variants) ? variants : [variants];
        nextSelectors = selectors
          .split(' ')
          .map(sel => `${sel} ${variantList.map(v => `${sel}--${v}`).join(' ')}`)
          .join(' ');
      }

      return [styleSelector, `${baseClass} ${nextSelectors}`];
    })
  ) as { base: string } & Omit<Record<string, string>, 'base'>;
};

export default parseStyleSelectors;
