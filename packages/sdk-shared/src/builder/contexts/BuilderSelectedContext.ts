import { createContext } from 'react';

export type BuilderSelectedContextValue = {
  elementSelected?: string;
  setSelected: (id?: string, iframeDOM?: HTMLIFrameElement, force?: boolean) => void;
};

const builderSelectedContextDefaultValue: BuilderSelectedContextValue = {} as BuilderSelectedContextValue;

const BuilderSelectedContext = createContext<BuilderSelectedContextValue>(builderSelectedContextDefaultValue);

export default BuilderSelectedContext;
