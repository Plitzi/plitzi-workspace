import type { InteractionCallback, InteractionCallbackParamValues, InteractionCallbackType } from './InteractionTypes';
import type { Style } from './StyleTypes';
import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';

// RSC
export type ElementRuntime = 'server' | 'client' | 'shared';
export type ElementLoadStrategy = 'eager' | 'lazy' | 'visible';

export type SchemaRsc = {
  enabled?: boolean;
  /** Wire protocol for RSC updates. 'json' is the default (data-only). 'stream' uses the RSC wire format (requires react-server condition). */
  transport?: 'json' | 'stream';
  /** Path for the RSC endpoint. Defaults to '/_rsc'. */
  path?: string;
};

// FlatMap
export type DropPosition = 'top' | 'bottom' | 'left' | 'right' | 'inside' | 'custom';

export type BindingCategory = 'attributes' | 'style' | 'initialState';

export type BindingTransformer = {
  action: string;
  params: Record<string, string>;
};

export type ElementBinding = {
  id: string;
  source: string;
  transformers?: BindingTransformer[];
  when?: RuleGroup;
  enabled?: boolean;
  to: string;
};

export type ElementInteraction<
  T extends Record<keyof InteractionCallback['params'], unknown> = Record<string, unknown>
> = {
  id: string;
  title: string;
  type: InteractionCallbackType;
  action: string;
  params: InteractionCallbackParamValues<T>;
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
  styleSelectors: { base: string; [selector: string]: string };
  bindings?: Partial<Record<BindingCategory, ElementBinding[]>>;
  interactions?: Record<string, ElementInteraction>;
  initialState?: {
    // example - styleVariant: { class1: { base: 'primary', selectorA: 'secondary', selectorB: ['primary', 'xs'] } }
    styleVariant?: Partial<Record<string, Partial<Record<string, string | string[]>>>>;
    styleSelectors?: ElementDefinition['styleSelectors'];
    visibility?: boolean;
    [key: string]: unknown;
  };
  /** Where this element is rendered. 'server' = SSR only, 'client' = browser only, 'shared' = both (default). */
  runtime?: ElementRuntime;
  /** Controls when the element is loaded/rendered. */
  loadStrategy?: ElementLoadStrategy;
};

export type Element<TAttributes extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  idRef?: string;
  attributes: TAttributes & { subType?: string };
  definition: ElementDefinition;
};

type SchemaVariableBase<TType extends string, TValue> = {
  name: string;
  category: string;
  type: TType;
  value: TValue;
  subValues: { when: RuleGroup; value: TValue }[];
};

export type SchemaVariable =
  | SchemaVariableBase<'number', number>
  | SchemaVariableBase<'checkbox' | 'switch', boolean>
  | SchemaVariableBase<'text' | 'email' | 'password' | 'select' | 'select2' | 'textarea' | 'color', string>;

export type PageFolder = { id: string; name: string; slug: string; parentId?: PageFolder['id'] };

export type Schema = {
  flat: Record<string, Element>;
  definition: { name: string; permanentUrl: string };
  variables: SchemaVariable[];
  settings: {
    keepState?: boolean;
    stateStorage?: 'localStorage' | 'sessionStorage';
    customCss: string;
    userProvider?: 'auth0' | 'basic' | 'custom' | '';
    auth0Domain?: string;
    auth0ClientId?: string;
    tokenStorage?: 'localStorage' | 'sessionStorage' | '';
    loginUrl?: string;
    userUrl?: string;
    refreshUrl?: string;
    logoutUrl?: string;
    detailsPath?: string;
    tokenPath?: string;
    expirationTimePath?: string;
  };
  rsc?: SchemaRsc;
  pages: Element['id'][];
  pageFolders: PageFolder[];
};

export type SchemaContextValue = {
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
    templatePlatform?: Style,
    variables?: SchemaVariable[],
    fromSubscriptions?: boolean
  ) => void;
  schemaUpdateSettings?: (value: string | number | boolean, path?: string, fromSubscriptions?: boolean) => void;
};

// Raw

export type SchemaRaw = {
  definition: Schema['definition'];
  flat: Element[];
  variables: SchemaVariable[];
  settings: Schema['settings'];
  rsc?: Schema['rsc'];
  pages: Element['id'][];
  pageFolders: PageFolder[];
};
