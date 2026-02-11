import set from 'lodash-es/set.js';

import { styleConstants } from '@plitzi/sdk-shared';

import type { StyleCategory, StyleItem } from '@plitzi/sdk-shared';

const mediaRegex = /@media[^{]*\{(?:[^{}]*|\{[^{}]*\})*\}/gim;
const cssRegex =
  /(?<selector>\.|#|)(?<selectorName>[a-z0-9_-]+)([ ]+|){(?<selectorData>[a-z0-9:; (),.%\n*/#+"'_-]+|)}/gim;
const cssPropsRegex = /(?<propName>[a-z-]+):([ ]+|)(?<propValue>([a-z-]+\([^;]\)|".*"|[a-z0-9 (),.%\n*/#+"':_-]+));/gim;
const cssIsCommentRegex = /(\/\*.*\*\/)/gim;
const StyleConstantsList = Object.values(styleConstants);

type StyleBasicItem = Omit<StyleItem, 'type' | 'cache'>;

export function cssToSelectors(css = ''): Record<string, StyleBasicItem> {
  const match = [...css.replace(mediaRegex, '').replaceAll('\n', '').matchAll(cssRegex)];
  const selectors = match.reduce<Record<string, StyleBasicItem>>((acum, match) => {
    const { selectorName, selectorData } = match.groups as Record<string, string>;
    const selectorResult: StyleBasicItem = { name: selectorName.trim(), variables: {}, attributes: {} };
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

// Helper function to check if a position is inside any media block
const isInsideMedia = (mediaBlocks: { from: number; to: number }[], pos: number) => {
  return mediaBlocks.some(block => pos >= block.from && pos < block.to);
};

export const getReadOnlyRangesFromContent = (doc = '') => {
  const ranges: { from: number; to: number }[] = [];
  let match: RegExpExecArray | null;

  // 1. Make entire @media blocks read-only
  let mediaMatch: RegExpExecArray | null;
  mediaRegex.lastIndex = 0;
  const mediaBlocks: { from: number; to: number }[] = [];
  while ((mediaMatch = mediaRegex.exec(doc))) {
    ranges.push({ from: mediaMatch.index, to: mediaRegex.lastIndex });
    mediaBlocks.push({ from: mediaMatch.index, to: mediaRegex.lastIndex });
  }

  // 2. Existing selector-based read-only logic

  let lastMatchEnd = 0;
  cssPropsRegex.lastIndex = 0;
  while ((match = cssRegex.exec(doc))) {
    const fullStart = match.index;
    const fullEnd = cssRegex.lastIndex;

    if (isInsideMedia(mediaBlocks, fullStart)) {
      continue; // Skip matches inside @media blocks
    }

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

  // Read-only after last selector
  ranges.push({ from: lastMatchEnd, to: doc.length });

  return ranges;
};
