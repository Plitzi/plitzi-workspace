import { createContext } from 'react';

export type BuilderHoveredContextValue = {
  elementHovered?: string;
  setHovered: (id?: string) => void;
};

const builderHoveredContextDefaultValue: BuilderHoveredContextValue = {} as BuilderHoveredContextValue;

const BuilderHoveredContext = createContext<BuilderHoveredContextValue>(builderHoveredContextDefaultValue);

export default BuilderHoveredContext;
