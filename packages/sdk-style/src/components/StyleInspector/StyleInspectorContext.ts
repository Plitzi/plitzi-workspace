import { createContext } from 'react';

import type { StyleHelperMetaData } from '../../StyleHelper';
import type { DisplayMode, StyleCategory, StyleItem, StyleValue, StyleVariables } from '@plitzi/sdk-shared';

export type StyleInspectorContextValue = {
  selector?: StyleItem;
  displayMode: DisplayMode;
  // values: Record<StyleCategory, StyleValue>;
  variables: Record<string, unknown>;
  selectorVariables?: StyleVariables;
  setValue: {
    (styleKey: StyleCategory, value?: StyleValue): void;
    (styleKey: StyleCategory[], value?: Partial<Record<StyleCategory, StyleValue>>): void;
  };
  resetValue: (keys: StyleCategory | StyleCategory[]) => void;
  inheritData: StyleHelperMetaData['style'];
  bindingData: Record<StyleCategory, StyleValue>;
  getDefaultValue: (key?: StyleCategory[] | StyleCategory) => StyleValue | Record<StyleCategory, StyleValue>;
};

const styleInspectorContextDefaultValue = {} as StyleInspectorContextValue;

const StyleInspectorContext = createContext<StyleInspectorContextValue>(styleInspectorContextDefaultValue);

export default StyleInspectorContext;
