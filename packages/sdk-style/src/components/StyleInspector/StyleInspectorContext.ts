import { createContext } from 'react';

import type { StyleHelperMetaData } from '../../StyleHelper';
import type { DisplayMode, Style, StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type StyleInspectorContextValue = {
  values: Style['platform'][DisplayMode][number]['attributes'];
  variables: Record<string, unknown>;
  displayMode?: DisplayMode;
  selector: string;
  setValue: {
    (styleKey: StyleCategory, value?: StyleValue): void;
    (styleKey: StyleCategory[], value?: Record<StyleCategory, StyleValue | undefined>): void;
  };
  resetValue: (keys: StyleCategory | StyleCategory[]) => void;
  inheritData: Record<string, StyleHelperMetaData['style'][string]>;
  bindingData: Record<string, StyleValue>;
  getDefaultValue: (key?: string[] | string) => StyleValue | Record<string, StyleValue>;
};

const styleInspectorContextDefaultValue = {} as StyleInspectorContextValue;

const StyleInspectorContext = createContext<StyleInspectorContextValue>(styleInspectorContextDefaultValue);

export default StyleInspectorContext;
