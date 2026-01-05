import { createContext } from 'react';

import type { DisplayMode, Style } from '../../types';

export type BuilderStyleContextValue = { style: Style; displayMode: DisplayMode };

const builderStyleContextDefaultValue: BuilderStyleContextValue = {} as BuilderStyleContextValue;

const BuilderStyleContext = createContext<BuilderStyleContextValue>(builderStyleContextDefaultValue);

export default BuilderStyleContext;
