import { createContext } from 'react';

import type { InheritData } from '../../helpers';
import type { DisplayMode, StyleCategory, StyleItem, StyleObject, StyleState, StyleValue } from '@plitzi/sdk-shared';

export type SetValues = {
  (path?: undefined, values?: StyleObject): void;
  (path: StyleCategory, values?: StyleValue): void;
};

export type StyleInspectorContextValue = {
  selector?: StyleItem;
  styleSelector: string;
  styleState?: StyleState;
  styleVariant?: string;
  displayMode: DisplayMode;
  variables: Record<string, unknown>;
  inheritData: InheritData['style'];
  bindingData: Partial<Record<StyleCategory, StyleValue>>;
  setValue: SetValues;
  resetValue: (keys: StyleCategory | StyleCategory[]) => void;
  getDefaultValue: (key?: StyleCategory[] | StyleCategory) => StyleValue | Record<StyleCategory, StyleValue>;
};

const styleInspectorContextDefaultValue = {} as StyleInspectorContextValue;

const StyleInspectorContext = createContext(styleInspectorContextDefaultValue);

export default StyleInspectorContext;
