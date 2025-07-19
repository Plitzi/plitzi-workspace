import { createContext } from 'react';

import type { Element, Schema, Style } from '@plitzi/sdk-shared';

export type Template = {
  id?: string;
  definition: {
    name: string;
    description: string;
    baseEleemntId: Element['id'];
  };
  schema: Schema;
  style: Style;
};

export type TemplatesContextValue = {
  templates: Record<string, Template>;
  templatesAdd: (template: Template) => void;
  templatesUpdate: (template: Template) => void;
  templatesRemove: (id: string) => void;
  elementAsTemplate: (
    schema: Schema,
    style: Style,
    name: string,
    description: string,
    element: Element
  ) => Promise<void>;
  templatesAddMutation: (name: string, description: string, schema: Schema, style: Style) => Promise<void>;
  templatesUpdateMutation: (template: Template) => Promise<void>;
  templatesRemoveMutation: (id: string) => Promise<void>;
};

const templateContextDefaultValue = { templates: {} } as TemplatesContextValue;

const TemplatesContext = createContext<TemplatesContextValue>(templateContextDefaultValue);

export default TemplatesContext;
