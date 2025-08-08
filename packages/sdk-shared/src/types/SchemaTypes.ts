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
  type: 'text' | 'number' | 'email' | 'password' | 'select' | 'select2' | 'checkbox' | 'textarea' | 'color' | 'switch';
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
  // When is main Schema in builder
  dispatchSchema?: unknown;
  schemaUpdate?: (newSchema: SchemaRaw, fromSubscriptions?: boolean) => void;
  schemaAddElement?: (
    to: string,
    data: Element,
    dropPosition?: DropPosition,
    initialItems?: Record<string, Element>,
    variables?: SchemaVariable[],
    fromSubscriptions?: boolean
  ) => void;
  schemaUpdateElement?: (element: Element, fromSubscriptions?: boolean) => void;
  schemaMoveElement?: (
    from: string,
    to: string,
    elementId: string,
    dropPosition?: DropPosition,
    fromSubscriptions?: boolean
  ) => void;
  schemaCloneElement?: (elementId: string, targetId?: string, fromSubscriptions?: boolean) => void;
  schemaRemoveElement?: (elementId: string, fromSubscriptions?: boolean) => void;
  schemaAddPage?: (page: Element, fromSubscriptions?: boolean) => Promise<void>;
  schemaHomePage?: (pageId: string, fromSubscriptions?: boolean) => void;
  schemaUpdatePage?: (page: Element, fromSubscriptions?: boolean) => void;
  schemaRemovePage?: (pageId: string, fromSubscriptions?: boolean) => void;
  schemaAddPageFolder?: (pageFolder: PageFolder, fromSubscriptions?: boolean) => Promise<void>;
  schemaUpdatePageFolder?: (pageFolder: PageFolder, fromSubscriptions?: boolean) => void;
  schemaRemovePageFolder?: (pageFolderId: string, fromSubscriptions?: boolean) => void;
  schemaAddVariable?: (variable: SchemaVariable, fromSubscriptions?: boolean) => void;
  schemaUpdateVariable?: (variable: SchemaVariable, fromSubscriptions?: boolean) => void;
  schemaRemoveVariable?: (name: string, fromSubscriptions?: boolean) => void;
  schemaAddTemplate?: (
    to: string,
    data: Element,
    dropPosition?: DropPosition,
    initialItems?: Record<string, Element>,
    templatePlatform?: Style['platform'],
    variables?: SchemaVariable[],
    fromSubscriptions?: boolean
  ) => void;
  schemaUpdateSettings?: (value: string | number | boolean, path?: string, fromSubscriptions?: boolean) => void;
};

// Raw

export type SchemaRaw = {
  flat: Element[];
  variables?: SchemaVariable[];
  settings: Schema['settings'];
  pages: Element['id'][];
  pageFolders: PageFolder[];
};
