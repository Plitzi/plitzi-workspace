import { createContext } from 'react';

import type { StyleHelperMetaData } from '../../StyleHelper';
import type { DisplayMode, StyleCategory, StyleItem, StyleState, StyleValue } from '@plitzi/sdk-shared';

export type SetValues = {
  (path?: undefined, values?: Exclude<StyleItem, { type: 'element' }>['attributes']): void;
  (path: StyleCategory, values?: StyleValue): void;
};

export type StyleInspectorContextValue = {
  selector?: StyleItem;
  styleSelector: string;
  styleState?: StyleState;
  displayMode: DisplayMode;
  variables: Record<string, unknown>;
  inheritData: StyleHelperMetaData['style'];
  bindingData: Partial<Record<StyleCategory, StyleValue>>;
  setValue: SetValues;
  resetValue: (keys: StyleCategory | StyleCategory[]) => void;
  getDefaultValue: (key?: StyleCategory[] | StyleCategory) => StyleValue | Record<StyleCategory, StyleValue>;
};

const styleInspectorContextDefaultValue = {} as StyleInspectorContextValue;

const StyleInspectorContext = createContext(styleInspectorContextDefaultValue);

export default StyleInspectorContext;
