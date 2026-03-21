import { createContext } from 'react';

import type { StyleHelperMetaData } from '../../StyleHelper';
import type { DisplayMode, StyleCategory, StyleItem, StyleValue } from '@plitzi/sdk-shared';

export type SetValues = {
  (path?: undefined, values?: Exclude<StyleItem, { type: 'class-component' }>['attributes']): void;
  (path: StyleCategory, values?: StyleValue): void;
};

export type StyleInspectorContextValue = {
  selector?: StyleItem;
  styleSelector?: string;
  displayMode: DisplayMode;
  variables: Record<string, unknown>;
  inheritData: StyleHelperMetaData['style'];
  bindingData: Partial<Record<StyleCategory, StyleValue>>;
  setValue: SetValues;
  resetValue: (keys: StyleCategory | StyleCategory[]) => void;
  getDefaultValue: (key?: StyleCategory[] | StyleCategory) => StyleValue | Record<StyleCategory, StyleValue>;
};

const styleInspectorContextDefaultValue = {} as StyleInspectorContextValue;

const StyleInspectorContext = createContext<StyleInspectorContextValue>(styleInspectorContextDefaultValue);

export default StyleInspectorContext;
