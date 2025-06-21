import type { InteractionCallbackType } from './InteractionTypes';
import type { Style } from './StyleTypes';
import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';

export type BindingTransformer = {
  type: 'utility' | 'unknown';
  action: string;
  params: {
    valueType: string;
    value: string;
  };
};

export type ElementBinding = {
  id: string;
  source: string;
  fromPath: string;
  transformers?: BindingTransformer[];
  when?: RuleGroup;
  enabled?: boolean;
  toPath: string;
};

export type ElementInteraction = {
  id: string;
  title: string;
  type: InteractionCallbackType;
  action: string;
  params: Record<string, unknown>;
  preview: Record<string, unknown>;
  elementId: string;
  beforeNode: string;
  afterNode: string;
  flowId: string;
  enabled: boolean;
  when?: RuleGroup;
};

export type ElementDefinition = {
  rootId: string;
  label: string;
  type: string;
  parentId?: string;
  items?: string[];
  styleSelectors: { [key: string]: string };
  bindings?: Record<string, ElementBinding[]>;
  interactions?: Record<string, ElementInteraction>;
  initialState?: {
    styleSelectors?: ElementDefinition['styleSelectors'];
    visibility?: boolean;
    [key: string]: unknown;
  };
};

export type Element = {
  id: string;
  definition: Omit<{ [key: string]: unknown }, keyof ElementDefinition> & ElementDefinition;
  attributes: Omit<{ [key: string]: unknown }, 'subType'> & {
    subType?: string;
  };
};

export type SchemaVariable = {
  name: string;
  category: string;
  type: string;
  value: string;
  subValues: {
    when: RuleGroup;
    value: string;
  }[];
};

export type PageFolder = { id: string; name: string; slug: string; parentId: string };

export type Schema = {
  flat: { [key: string]: Element };
  variables?: SchemaVariable[];
  settings: {
    customCss: string;
    userProvider?: 'auth0' | 'basic' | 'custom' | '';
    auth0Domain?: string;
    auth0ClientId?: string;
    loginUrl?: string;
    refreshUrl?: string;
    detailsPath?: string;
    tokenPath?: string;
    expirationTimePath?: string;
  };
  pages: string[];
  pageFolders: PageFolder[];
};

export type SchemaContextValue = {
  prevSchema?: Schema;
  schema: Schema;
  style?: Style;
  definition?: { rootId: string }; // for segments and templates
};
