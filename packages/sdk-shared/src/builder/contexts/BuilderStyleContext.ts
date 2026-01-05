import { createContext } from 'react';

import type { DisplayMode, Style, StyleItem } from '../../types';
import type { Dispatch, SetStateAction } from 'react';

export type BuilderStyleContextValue = {
  style: Style;
  displayMode: DisplayMode;
  selectorSelected?: StyleItem;
  setSelectorSelected?: Dispatch<SetStateAction<StyleItem | undefined>>;
  styleSelector: string;
  setStyleSelector?: Dispatch<SetStateAction<string>>;
};

const builderStyleContextDefaultValue: BuilderStyleContextValue = {} as BuilderStyleContextValue;

const BuilderStyleContext = createContext<BuilderStyleContextValue>(builderStyleContextDefaultValue);

export default BuilderStyleContext;
