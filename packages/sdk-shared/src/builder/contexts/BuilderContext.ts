import { createContext } from 'react';

import type { Element, PluginBuilder } from '../../types';
import type { Dispatch, SetStateAction } from 'react';

export type HandlerEvent =
  // Root Schema Events
  | 'schemaAddPage'
  | 'schemaHomePage'
  | 'schemaUpdatePage'
  | 'schemaRemovePage'
  | 'schemaAddPageFolder'
  | 'schemaUpdatePageFolder'
  | 'schemaRemovePageFolder'
  | 'schemaUpdateSettings'
  // Schema Events (can be root as well)
  | 'schemaUpdate'
  | 'schemaAddElement'
  | 'schemaUpdateElement'
  | 'schemaRemoveElement'
  | 'schemaMoveElement'
  | 'schemaCloneElement'
  | 'schemaAddTemplate'
  // Style Events
  | 'styleUpdate'
  | 'styleAddSelector'
  | 'styleUpdateSelector'
  | 'styleRemoveSelector'
  | 'styleAddVariable'
  | 'styleUpdateVariable'
  | 'styleRemoveVariable'
  | 'styleAddTemplate'
  // Builder Events
  | 'builderSetBaseContext'
  | 'builderSetSelected'
  | 'builderSetHovered';

export type BuilderContextValue = {
  mode: 'normal' | 'template' | 'segment';
  schemaName: string;
  setMultiPagesMode: Dispatch<SetStateAction<boolean>>;
  multiPagesMode: boolean;
  hasMultiPages: boolean;
  baseContext: { baseElementId: string };
  baseElementIdOriginal: string;
  builderSetBaseContext: (id?: string) => void;
  builderElementPermissions: {
    (element: Element, path?: undefined, defaultValue?: boolean): PluginBuilder;
    (element: Element, path: string, defaultValue?: boolean): boolean | undefined;
  };
  builderHandler: (event: HandlerEvent, ...data: unknown[]) => void;
  updateElement: (elementId: string, attributeKey: string, attributeValue: unknown, category?: keyof Element) => void;
};

const builderContextDefaultValue: BuilderContextValue = {} as BuilderContextValue;

const BuilderContext = createContext<BuilderContextValue>(builderContextDefaultValue);

export default BuilderContext;

// { ...permissions, canDelete: false, canTemplate: false, canMove: false }
