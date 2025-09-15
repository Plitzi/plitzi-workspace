import { createContext } from 'react';

import type { StyleHelperMetaData } from '../../StyleHelper';
import type { DisplayMode, StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type StyleInspectorContextValue = {
  values: Record<StyleCategory, StyleValue>;
  variables: Record<string, unknown>;
  displayMode?: DisplayMode;
  selector: string;
  setValue: {
    (styleKey: StyleCategory, value?: StyleValue): void;
    (styleKey: StyleCategory[], value?: Partial<Record<StyleCategory, StyleValue>>): void;
  };
  resetValue: (keys: StyleCategory | StyleCategory[]) => void;
  inheritData: StyleHelperMetaData;
  bindingData: Record<StyleCategory, StyleValue>;
  getDefaultValue: (key?: StyleCategory[] | StyleCategory) => StyleValue | Record<StyleCategory, StyleValue>;
};

const styleInspectorContextDefaultValue = {} as StyleInspectorContextValue;

const StyleInspectorContext = createContext<StyleInspectorContextValue>(styleInspectorContextDefaultValue);

export default StyleInspectorContext;
