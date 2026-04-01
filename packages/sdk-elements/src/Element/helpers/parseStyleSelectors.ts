import type { Element } from '@plitzi/sdk-shared';

const parseStyleSelectors = (definition: Element['definition']) => {
  const styleVariant = definition.initialState?.styleVariant;

  return Object.fromEntries(
    Object.entries(definition.styleSelectors).map(([styleSelector, selectors]) => {
      const baseClass =
        styleSelector === 'base' ? `plitzi__${definition.type}` : `plitzi__${definition.type}-${styleSelector}`;

      if (typeof selectors !== 'string') {
        return [styleSelector, selectors];
      }

      if (!selectors.includes(definition.type) && styleVariant?.[definition.type]?.[styleSelector]) {
        selectors = selectors ? `${definition.type} ${selectors}` : definition.type;
      }

      const nextSelectors = selectors
        .split(' ')
        .map(sel => {
          const variantsForSelector = styleVariant?.[sel]?.[styleSelector];
          if (!variantsForSelector) {
            return sel;
          }

          const list = Array.isArray(variantsForSelector) ? variantsForSelector : [variantsForSelector];
          if (sel === definition.type) {
            return list.map(v => `${sel}--${v}`).join(' ');
          }

          return [sel, ...list.map(v => `${sel}--${v}`)].join(' ');
        })
        .join(' ');

      if (!nextSelectors) {
        return [styleSelector, baseClass];
      }

      return [styleSelector, `${baseClass} ${nextSelectors}`];
    })
  ) as { base: string } & Omit<Record<string, string>, 'base'>;
};

export default parseStyleSelectors;
