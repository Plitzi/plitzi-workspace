import { createContext } from 'react';

import type { Schema } from '../../types';
import type { ComponentPlugin, ComponentPlugins } from '../../types/ComponentTypes';

type DropPosition = 'top' | 'bottom' | 'left' | 'right' | 'inside';

export type BuilderSchemaContextValue = {
  schema: Schema;
  builderGetBaseElement: (
    otherBaseElementId: string
  ) => undefined | { data: Element; Plugin: ComponentPlugin | ComponentPlugins };
  builderDropElement: (
    type: string,
    data: unknown,
    dropPosition: DropPosition,
    toElementId: string,
    rootId?: string
  ) => Promise<boolean>;
  builderSetElementVisibility: (elementId: string, visibility: boolean) => void;
};

const builderSchemaContextDefaultValue: BuilderSchemaContextValue = {} as BuilderSchemaContextValue;

const BuilderSchemaContext = createContext<BuilderSchemaContextValue>(builderSchemaContextDefaultValue);

export default BuilderSchemaContext;
