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
};

// FlatMap
export type DropPosition = 'top' | 'bottom' | 'left' | 'right' | 'inside' | 'custom';

export type BindingCategory = 'attributes' | 'style' | 'initialState';

export type BindingTransformer = {
  action: string;
  params: Record<string, string>;
  enabled?: boolean;
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
  // The element the step is registered on: an element idRef for a `callback`/`trigger`, the source module for a
  // `globalCallback` (e.g. `space`/`state`). A `utility` is resolved by its action alone (`utility[action]`) and is
  // registered on NO element, so its elementId is null.
  elementId: Element['id'] | null;
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
    refreshTokenPath?: string;
    expirationTimePath?: string;
    refreshExpirationTimePath?: string;
    /**
     * Name of a readable (non-httpOnly) cookie your backend sets alongside its session cookie, whose value is
     * `<access expiry>.<refresh expiry>` in unix seconds. It carries no credential — only when the session dies —
     * and it is what lets a page answer "is anyone signed in here?" with no request at all, including the answer
     * "no". Without it, a first load with empty storage has to ask the backend to find out.
     */
    sessionHintCookie?: string;
    /**
     * Where to hand a credential this browser obtained on its own, so the rendering server can establish a session
     * of its own for it. Declaring it is how a space says "my sign-in happens in the browser" — a client-side
     * identity provider (Auth0 and the like) leaves the server rendering pages as a guest while the browser knows
     * who this is, and the page changes under the visitor as it hydrates. Leave empty when your backend issues the
     * session itself, which is the case whenever `loginUrl` is your own API.
     */
    sessionExchangeUrl?: string;
    /**
     * What to do on a page that requires a session while the stored one is being re-checked. `optimistic` (the
     * default) renders from the stored session and signs out if the check disagrees; `strict` waits for the answer,
     * trading a round trip for never showing a signed-in page to someone whose session has just ended.
     */
    sessionGate?: 'optimistic' | 'strict';
    /** How old a confirmation may get before the SDK re-checks on the next focus. Defaults to 300. */
    sessionRevalidateSeconds?: number;
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
  schemaUpdateElements?: (elements: Element[], fromSubscriptions?: boolean) => void;
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
