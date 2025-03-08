import { createContext } from 'react';

import type { Style, StyleItem } from '../../types';
import type { Dispatch, SetStateAction } from 'react';

export type BuilderStyleContextValue = {
  style: Style;
  selectorSelected?: Pick<StyleItem, 'name' | 'type'>;
  setSelectorSelected: Dispatch<SetStateAction<Pick<StyleItem, 'name' | 'type'> | undefined>>;
  styleSelector: string;
  setStyleSelector: Dispatch<SetStateAction<string>>;
};

const builderStyleContextDefaultValue: BuilderStyleContextValue = {} as BuilderStyleContextValue;

const BuilderStyleContext = createContext<BuilderStyleContextValue>(builderStyleContextDefaultValue);

export default BuilderStyleContext;
