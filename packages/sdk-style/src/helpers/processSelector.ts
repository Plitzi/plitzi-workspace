import processSelectorAttributes from './processSelectorAttributes';
import processSelectorName from './processSelectorName';
import processSelectorVariables from './processSelectorVariables';

import type { StyleItem } from '@plitzi/sdk-shared';

const processSelector = (selector: Omit<StyleItem, 'cache'>) => {
  const attributes = processSelectorAttributes(selector);
  const name = processSelectorName(selector);
  const variablesSelector = processSelectorVariables(selector);
  if (!variablesSelector) {
    return `${name}{${attributes.join('')}}`;
  }

  const extraCss: string[] = [];
  attributes.push(...variablesSelector.default);
  if (variablesSelector.light.length > 0) {
    extraCss.push(`@media(prefers-color-scheme:light){${name}{${variablesSelector.light.join('')}}}`);
  }

  if (variablesSelector.dark.length > 0) {
    extraCss.push(`@media(prefers-color-scheme:dark){${name}{${variablesSelector.dark.join('')}}}`);
  }

  if (extraCss.length === 0) {
    return `${name}{${attributes.join('')}}`;
  }

  return `${name}{${attributes.join('')}}${extraCss.join('')}`;
};

export const processSelectorsMultiLine = (selectors: Omit<StyleItem, 'cache'>[], tabIndentSpace = 2) => {
  const separator = ' '.repeat(tabIndentSpace);
  const separatorMedia = ' '.repeat(tabIndentSpace * 2);
  const output = selectors.map(selector => {
    const name = processSelectorName(selector);
    const attributes = processSelectorAttributes(selector);
    const variablesSelector = processSelectorVariables(selector);
    if (variablesSelector) {
      attributes.push(...variablesSelector.default);
    }

    const body = attributes
      .map(attribute => `${separator}${attribute}`)
      .join('\n')
      .replaceAll(':', ': ');
    if (!variablesSelector) {
      return `${name} {\n${body}\n}`;
    }

    const extraCss: string[] = [];
    attributes.push(...variablesSelector.default);
    if (variablesSelector.light.length > 0) {
      const bodyLight = variablesSelector.light
        .map(variable => `${separatorMedia}${variable}`)
        .join('\n')
        .replaceAll(':', ': ');
      extraCss.push(`\n@media(prefers-color-scheme: light) {\n${separator}${name} {\n${bodyLight}\n${separator}}\n}`);
    }

    if (variablesSelector.dark.length > 0) {
      const bodyDark = variablesSelector.dark
        .map(variable => `${separatorMedia}${variable}`)
        .join('\n')
        .replaceAll(':', ': ');
      extraCss.push(`\n@media(prefers-color-scheme: dark) {\n${separator}${name} {\n${bodyDark}\n${separator}}\n}`);
    }

    if (extraCss.length === 0) {
      return `${name} {${attributes.join('')}}`;
    }

    return `${name} {\n${body}\n}\n${extraCss.join('\n')}`;
  });

  return output;
};

export default processSelector;
