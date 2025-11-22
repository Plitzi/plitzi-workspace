import set from 'lodash-es/set.js';

import { StyleConstants } from '@plitzi/sdk-shared';

import type { StyleBaseItem, StyleCategory } from '@plitzi/sdk-shared';

const cssRegex =
  /(?<selector>\.|#|)(?<selectorName>[a-z0-9_-]+)([ ]+|){(?<selectorData>[a-z0-9:; (),.%\n*/#+"'_-]+|)}/gim;
const cssPropsRegex = /(?<propName>[a-z-]+):([ ]+|)(?<propValue>([a-z-]+\([^;]\)|".*"|[a-z0-9 (),.%\n*/#+"':_-]+));/gim;
const cssIsCommentRegex = /(\/\*.*\*\/)/gim;
const StyleConstantsList = Object.values(StyleConstants);

export function cssToSelectors(css = ''): Record<string, StyleBaseItem> {
  const match = [...css.replaceAll('\n', '').matchAll(cssRegex)];
  const selectors = match.reduce<Record<string, StyleBaseItem>>((acum, match) => {
    const { selectorName, selectorData } = match.groups as Record<string, string>;
    const selectorResult: StyleBaseItem = { name: selectorName.trim(), attributes: {}, cache: match[0] };
    if (selectorData) {
      const propsMatch = [...selectorData.replaceAll(cssIsCommentRegex, '').trim().matchAll(cssPropsRegex)];
      propsMatch
        .filter(prop => StyleConstantsList.includes((prop.groups as Record<string, StyleCategory>).propName))
        .forEach(prop => {
          const { propName, propValue } = prop.groups as Record<string, string>;
          set(selectorResult, `attributes.${propName.trim()}`, propValue.trim());
        });
    }

    return { ...acum, [selectorName]: selectorResult };
  }, {});

  return selectors;
}

export const getReadOnlyRangesFromContent = (doc = '') => {
  const ranges: { from: number | null; to: number | null }[] = [];
  let match: RegExpExecArray | null;
  let lastMatchEnd = 0;

  while ((match = cssRegex.exec(doc))) {
    const fullStart = match.index;
    const fullEnd = cssRegex.lastIndex;

    const selectorData = match.groups?.selectorData || '';
    const dataStart = doc.indexOf(selectorData, fullStart);
    const dataEnd = dataStart + selectorData.length;

    // ReadOnly before selectors
    if (lastMatchEnd < fullStart) {
      ranges.push({ from: lastMatchEnd, to: fullStart });
    }

    // ReadOnly before content
    if (fullStart < dataStart) {
      ranges.push({ from: fullStart, to: dataStart });
    }

    // ReadOnly after content
    if (dataEnd < fullEnd) {
      ranges.push({ from: dataEnd, to: fullEnd });
    }

    lastMatchEnd = fullEnd;
  }

  // ReadOnly after last selector
  ranges.push({ from: lastMatchEnd, to: doc.length });

  return ranges;
};

function formatCssFromSelector(
  css: string,
  singleSelector: true,
  tabIndentSpace?: number,
  filterProps?: boolean
): string;
function formatCssFromSelector(
  css: string,
  singleSelector: false,
  tabIndentSpace?: number,
  filterProps?: boolean
): string[];
function formatCssFromSelector(css: string, singleSelector = true, tabIndentSpace = 2, filterProps = true) {
  const match = [...css.replaceAll('\n', '').matchAll(cssRegex)];
  const selectors = match.map(match => {
    const { selector, selectorName, selectorData } = match.groups as Record<string, string>;
    if (!selectorData) {
      return `${selector}${selectorName} {\n}`;
    }

    const propsMatch = [...selectorData.matchAll(cssPropsRegex)];
    let propsString = '';
    propsMatch
      .filter(
        prop => !filterProps || StyleConstantsList.includes((prop.groups as Record<string, StyleCategory>).propName)
      )
      .forEach(prop => {
        const { propName, propValue } = prop.groups as Record<string, string>;
        if (propName && propValue) {
          propsString = `${propsString}${propsString === '' ? '' : '\n'}${' '.repeat(
            tabIndentSpace
          )}${propName}: ${propValue};`;
        } else {
          console.log('HEY', propName, propValue);
        }
      });

    return `${selector}${selectorName} {\n${propsString}\n}`;
  });

  if (singleSelector && Array.isArray(selectors) && selectors.length > 0) {
    return selectors[0];
  }

  if (singleSelector && selectors.length === 0) {
    return '';
  }

  return selectors;
}

export default formatCssFromSelector;
