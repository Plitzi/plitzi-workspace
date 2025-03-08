import { createContext } from 'react';

import type { Element } from '../../types';
import type { Dispatch, SetStateAction } from 'react';

export type BuilderContextValue = {
  mode: 'normal' | 'template' | 'segment';
  schemaName: string;
  setMultiPagesMode: Dispatch<SetStateAction<boolean>>;
  multiPagesMode: boolean;
  hasMultiPages: boolean;
  baseContext: { baseElementId: string };
  baseElementIdOriginal: string;
  builderSetBaseContext: (id: string) => void;
  builderElementPermissions: (element: Element, path?: string, defaultValue?: boolean) => Record<string, boolean>;
  builderHandler: (event: string, ...data: unknown[]) => void;
  updateElement: (elementId: string, attributeKey: string, attributeValue: unknown, category?: keyof Element) => void;
};

const builderContextDefaultValue: BuilderContextValue = {} as BuilderContextValue;

const BuilderContext = createContext<BuilderContextValue>(builderContextDefaultValue);

export default BuilderContext;
