import { createContext } from 'react';

import type { DropPosition, Element, Schema, Style } from '../../types';
import type { ComponentPluginWithHOC } from '../../types/ComponentTypes';

export type BuilderSchemaContextValue = {
  schema: Schema;
  builderGetBaseElement: (
    otherBaseElementId?: string
  ) => undefined | { data: Element; Plugin: ComponentPluginWithHOC | Record<string, ComponentPluginWithHOC> };
  builderDropElement: {
    (
      type: 'add##plitzi-template',
      data: {
        elements: Record<string, Element>;
        baseElement?: Element;
        style: Style;
        variables: Schema['variables'];
      },
      dropPosition: DropPosition,
      toElementId: string,
      rootId?: string
    ): boolean;
    <T extends string>(
      type: `add##${Exclude<T, 'plitzi-template'>}`,
      data: {
        id: string;
        element: Element;
      },
      dropPosition: DropPosition,
      toElementId: string,
      rootId?: string
    ): boolean;
    <T extends string>(
      type: `move##${Exclude<T, 'plitzi-template'>}`,
      data: {
        id: string;
        parentId: string;
        element: Element;
      },
      dropPosition: DropPosition,
      toElementId: string,
      rootId?: string
    ): boolean;
    (
      type: string,
      data:
        | {
            elements: Record<string, Element>;
            baseElement?: Element;
            style: Style;
            variables: Schema['variables'];
          }
        | {
            id: string;
            element: Element;
          }
        | {
            id: string;
            parentId: string;
            element: Element;
          },
      dropPosition: DropPosition,
      toElementId: string,
      rootId?: string
    ): boolean;
  };
  builderSetElementVisibility: (elementId: string, visibility: boolean) => void;
};

const builderSchemaContextDefaultValue: BuilderSchemaContextValue = {} as BuilderSchemaContextValue;

const BuilderSchemaContext = createContext<BuilderSchemaContextValue>(builderSchemaContextDefaultValue);

export default BuilderSchemaContext;
