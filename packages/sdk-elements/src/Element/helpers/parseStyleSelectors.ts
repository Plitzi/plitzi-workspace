import type { Element } from '@plitzi/sdk-shared';

const regexCache = new Map<string, RegExp>();

const getTypeRegex = (type: string) => {
  let regex = regexCache.get(type);
  if (!regex) {
    regex = new RegExp(`(^|\\s)${type}(?=\\s|$)`);
    regexCache.set(type, regex);
  }

  return regex;
};

const parseStyleSelectors = (definition: Element['definition']) => {
  const styleVariant = definition.initialState?.styleVariant;

  return Object.fromEntries(
    Object.entries(definition.styleSelectors).map(([styleSelector, selectors]) => {
      const baseClass =
        styleSelector === 'base' ? `plitzi__${definition.type}` : `plitzi__${definition.type}-${styleSelector}`;

      if (typeof selectors !== 'string') {
        return [styleSelector, selectors];
      }

      const hasExactTypeSelector = getTypeRegex(definition.type).test(selectors);
      if (!hasExactTypeSelector && styleVariant?.[definition.type]?.[styleSelector]) {
        selectors = selectors ? `${definition.type} ${selectors}` : definition.type;
      }

      const nextSelectors = selectors.replace(/\S+/g, sel => {
        const variantsForSelector = styleVariant?.[sel]?.[styleSelector];
        if (!variantsForSelector) {
          return sel;
        }

        const list = Array.isArray(variantsForSelector) ? variantsForSelector : [variantsForSelector];
        if (sel === definition.type) {
          return list.map(v => `${sel}--${v}`).join(' ');
        }

        return `${sel} ${list.map(v => `${sel}--${v}`).join(' ')}`;
      });

      if (!nextSelectors) {
        return [styleSelector, baseClass];
      }

      return [styleSelector, `${baseClass} ${nextSelectors}`];
    })
  ) as { base: string } & Omit<Record<string, string>, 'base'>;
};

export default parseStyleSelectors;
