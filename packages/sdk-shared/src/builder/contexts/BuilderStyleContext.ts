import { createContext } from 'react';

import type { DisplayMode, Style } from '../../types';
import type { Dispatch, SetStateAction } from 'react';

export type BuilderStyleContextValue = {
  style: Style;
  displayMode: DisplayMode;
  selector?: string;
  setSelector?: Dispatch<SetStateAction<string | undefined>>;
};

const builderStyleContextDefaultValue: BuilderStyleContextValue = {} as BuilderStyleContextValue;

const BuilderStyleContext = createContext<BuilderStyleContextValue>(builderStyleContextDefaultValue);

export default BuilderStyleContext;
