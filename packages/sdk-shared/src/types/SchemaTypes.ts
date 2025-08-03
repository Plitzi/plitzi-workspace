import type { InteractionCallbackParamValues, InteractionCallbackType } from './InteractionTypes';
import type { Style } from './StyleTypes';
import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';

// FlatMap
export type DropPosition = 'top' | 'bottom' | 'left' | 'right' | 'inside' | 'custom';

export type BindingTransformer = {
  type: 'utility' | 'unknown';
  action: string;
  params: { valueType: string; value: string };
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
  params: InteractionCallbackParamValues;
  preview: Record<string, unknown>;
  elementId: Element['id'];
  beforeNode: string;
  afterNode: string;
  flowId: string;
  enabled: boolean;
  when?: RuleGroup;
};

export type ElementDefinition = {
  rootId: Element['id'];
  label: string;
  type: string;
  parentId?: Element['id'];
  items?: Element['id'][];
  styleSelectors: Record<string, string>;
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
  attributes: Omit<{ [key: string]: unknown }, 'subType'> & { subType?: string };
};

export type SchemaVariable = {
  name: string;
  category: string;
  type: string;
  value: string;
  subValues: { when: RuleGroup; value: string }[];
};

export type PageFolder = { id: string; name: string; slug: string; parentId?: PageFolder['id'] };

export type Schema = {
  flat: Record<string, Element>;
  variables?: SchemaVariable[];
  settings: {
    keepState?: boolean;
    stateStorage?: 'sessionStorage' | 'localStorage';
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
  pages: Element['id'][];
  pageFolders: PageFolder[];
};

export type SchemaContextValue = {
  prevSchema?: Schema;
  schema: Schema;
  style?: Style;
  definition?: { rootId: string }; // for segments and templates
};

// Raw

export type SchemaRaw = {
  flat: Element[];
  variables?: SchemaVariable[];
  setings: Schema['settings'];
  pages: Element['id'][];
  pageFolders: PageFolder[];
};
