import { createContext } from 'react';

import type {
  ComponentPluginWithHOC,
  DropPosition,
  Element,
  EventBridgeEvent,
  PluginBuilder,
  Schema,
  Style,
  StyleThemeMode
} from '../../types';
import type { Dispatch, SetStateAction } from 'react';

export type BuilderContextValue = {
  theme: StyleThemeMode;
  setTheme: Dispatch<SetStateAction<StyleThemeMode>>;
  mode: 'normal' | 'template' | 'segment';
  schemaName: string;
  setMultiPagesMode: Dispatch<SetStateAction<boolean>>;
  multiPagesMode: boolean;
  hasMultiPages: boolean;
  baseContext: { baseElementId: string };
  baseElementIdOriginal: string;
  builderSetBaseContext: (id?: string) => void;
  builderElementPermissions: {
    (element: Element, path: string, defaultValue?: boolean): boolean;
    (element: Element, path?: undefined, defaultValue?: boolean): PluginBuilder;
    (element: Element, path?: string, defaultValue?: boolean): boolean | PluginBuilder;
  };
  builderHandler: (event: EventBridgeEvent, ...data: unknown[]) => void;
  updateElement: (
    elementId: string,
    attributeKey: string,
    attributeValue: unknown,
    category?: 'attributes' | 'definition'
  ) => void;
  elementAsTemplate: (
    cdnIdentifier: string,
    schema: Schema,
    style: Style,
    name: string,
    description: string,
    element: Element
  ) => Promise<void>;
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

const builderContextDefaultValue: BuilderContextValue = {} as BuilderContextValue;

const BuilderContext = createContext<BuilderContextValue>(builderContextDefaultValue);

export default BuilderContext;
