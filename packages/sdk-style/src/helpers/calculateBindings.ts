import set from 'lodash/set.js';

import type { Element, ElementBinding, StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const calculateBindings = (element?: Element) => {
  const metadata: { style: Record<StyleCategory, StyleValue> } = { style: {} as Record<StyleCategory, StyleValue> };
  if (!element) {
    return metadata;
  }

  const {
    definition: { bindings }
  } = element;

  if (!bindings || !(bindings as Record<string, ElementBinding[] | undefined>).style) {
    return metadata;
  }

  Object.keys(bindings.style).forEach(styleKey => {
    set(metadata.style, styleKey, true);
  });

  return metadata;
};

export default calculateBindings;
