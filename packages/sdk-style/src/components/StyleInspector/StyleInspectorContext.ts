import { createContext } from 'react';

import type { StyleHelperMetaData } from '../../StyleHelper';
import type { DisplayMode, StyleCategory, StyleItem, StyleValue } from '@plitzi/sdk-shared';

export type StyleInspectorContextValue = {
  selector?: StyleItem;
  displayMode: DisplayMode;
  variables: Record<string, unknown>;
  inheritData: StyleHelperMetaData['style'];
  bindingData: Partial<Record<StyleCategory, StyleValue>>;
  setValue: {
    (styleKey: StyleCategory, value?: StyleValue): void;
    (styleKey: StyleCategory[], value?: Partial<Record<StyleCategory, StyleValue>>): void;
  };
  resetValue: (keys: StyleCategory | StyleCategory[]) => void;
  getDefaultValue: (key?: StyleCategory[] | StyleCategory) => StyleValue | Record<StyleCategory, StyleValue>;
};

const styleInspectorContextDefaultValue = {} as StyleInspectorContextValue;

const StyleInspectorContext = createContext<StyleInspectorContextValue>(styleInspectorContextDefaultValue);

export default StyleInspectorContext;
