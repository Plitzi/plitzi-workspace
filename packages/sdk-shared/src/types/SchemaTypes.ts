import type { InteractionCallbackParamValues, InteractionCallbackType } from './InteractionTypes';
import type { ChannelDeclarations } from './RealtimeTypes';
import type { SnippetStyle } from './SnippetTypes';
import type { BuiltinParam } from '../authoring/paramSpec';
import type { ElementMotion } from '../schema/motion';
import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';

// RSC
export type ElementRuntime = 'server' | 'client' | 'shared';

/**
 * When an element's CONTENTS are mounted, relative to its own `visibility`.
 *
 * About the subtree, never about the element itself: whatever a hidden element registers — a modal's `openModal`
 * callback, a form's source, an interaction trigger — is registered by the element, so an element that stops
 * rendering is an element nothing can ever show again. The shell always renders; what these decide is its items.
 *
 * - `eager` (default): always mounted. Right for an element that is on screen almost always — deferring it would only
 *   add a render cycle between the page loading and the page appearing — and for a hidden element whose contents
 *   have to be in the server's HTML: a section a search engine should read, a panel a CSS-only accordion opens
 *   without the SDK's help.
 * - `lazy`: mounted the first time it is shown, and kept from then on. The one for elements that start hidden by
 *   nature, and those declare it themselves — a modal or a dialog nobody opens costs nothing, and one that has been
 *   opened keeps what the visitor typed into it.
 * - `visible`: mounted only while shown. Pays the build cost on every reveal and drops the subtree's state on
 *   every hide — worth it for contents that are expensive to KEEP (a live map, a video, a polling source).
 */
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
  /**
   * Mostly text, and not only: a param the builder draws as a checkbox (`styleVariant`'s `append`) is stored as the
   * boolean it is, and the transformer reads it as one — `if (!append)`. Writing `"false"` there would read as true.
   */
  params: Record<string, string | number | boolean>;
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

/**
 * What a trigger does when it fires again while the flow it started is still running.
 *
 * - `skip` (the default): the new firing is ignored — what keeps a double click from submitting twice.
 * - `parallel`: every firing runs its own flow, at the same time.
 * - `queue`: every firing runs, one after another, in the order they came — none lost, none overlapping.
 * - `latest`: every firing runs, and the run before it stops — it starts no further step, and the step it is waiting
 *   on stops if it can (a server action, a request). A search as you type: only the last question is answered.
 */
export type WhileRunning = 'skip' | 'parallel' | 'queue' | 'latest';

export const WHILE_RUNNING_MODES: readonly WhileRunning[] = ['skip', 'parallel', 'queue', 'latest'];

export type ElementInteraction<T extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  title: string;
  type: InteractionCallbackType;
  action: string;
  params: InteractionCallbackParamValues<T>;
  preview: Record<string, unknown>;
  // The element the step is registered on: an element id for a `callback`/`trigger`, the source module for a
  // `globalCallback` (e.g. `space`/`state`). A `utility` is resolved by its action alone (`utility[action]`) and is
  // registered on NO element, so its elementId is null.
  elementId: Element['id'] | null;
  beforeNode: string;
  afterNode: string;
  flowId: string;
  enabled: boolean;
  when?: RuleGroup;
  /** On a trigger only: what a firing does while this flow is still running. `skip` when absent. */
  whileRunning?: WhileRunning;
};

/**
 * What a feature flag gates an element on: it exists only while the flag `name` resolves to `is`.
 *
 * Not a visibility. A hidden element is still rendered, its markup still in the page; a gated one whose flag says no
 * is not rendered at all — not on the server, not in the browser, not its subtree — and the data of its server
 * elements is not resolved. Its declaration still travels with the space's document, as every element's does, so a
 * flag switches a feature off; it does not keep it secret. `is: false` is the other half of a rollout: the old
 * version, shown until the flag turns on.
 * On a page, a flag that says no makes the page not found.
 */
export type ElementFlagGate = { name: string; is: boolean };

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
  /** When this element's items are mounted, relative to its `visibility`. See {@link ElementLoadStrategy}. */
  loadStrategy?: ElementLoadStrategy;
  /** The feature flag this element exists under. See {@link ElementFlagGate}. */
  flag?: ElementFlagGate;
  /**
   * The `id` this element carries in the DOM, so a link to `/page#anchor` lands on it — `data-id` names the element
   * for the platform, this names it for the URL. One per rendered page, layouts included (`isAnchor`).
   */
  anchor?: string;
  /** How it arrives and whether it keeps moving, played by the SDK's stylesheet. See {@link ElementMotion}. */
  motion?: ElementMotion;
  /**
   * The codes of the suggestions this element is not offered, because it is written this way on purpose —
   * `['repeated-shape']`. Read by the one place suggestions are made (`suggestSpace`), so authoring, the builder and
   * the MCP leave out the same ones. Never a problem's code.
   */
  quiet?: string[];
};

/**
 * An element, keyed by the one name it answers to.
 *
 * `id` is that name: the `flat` key, what `parentId`/`items`/`rootId` point at, the `<type>_<id>` a binding's source
 * is built from, and the target an interaction wires to. It is chosen — typed by a person in the builder's tree,
 * written by an agent, or minted as `<type>-<n>` — never an opaque generated handle, so the key an author writes
 * down is the key the runtime resolves. `definition.label` stays free display text and wires nothing.
 */
export type Element<TAttributes extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
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

/** A value a flag takes where its `when` matches. The first rule that matches decides. */
export type SchemaFlagRule = { when: RuleGroup; value: boolean };

/**
 * A feature flag the space declares, under the name it is read by: `{{ flags.newCheckout }}`.
 *
 * Read with the document, stored apart from it: each environment has one set, shared by every revision it serves, so a
 * flag is turned without a new revision and a rollback keeps the flags as they are. A revision keeps a copy of the flags
 * it was published with, read only when the environment's own cannot be. The draft (`main`) applies whatever it says
 * now; a published environment, what was last published to it. Its rules see the environment, the host, the URL and
 * who is visiting (`user.authenticated`, `user.email`, `user.username`, `user.roles`). Whoever runs the space may
 * override the answer — the server it is rendered by, then the SDK embedding it, then a tester with the dev tools —
 * but only for flags declared here.
 */
export type SchemaFlag = {
  description?: string;
  /** The answer when no rule matches. */
  value: boolean;
  rules: SchemaFlagRule[];
};

export type PageFolder = { id: string; name: string; slug: string; parentId?: PageFolder['id'] };

/**
 * A prop a component declares, as the document stores it: the part of a `BuiltinParam` that survives JSON — no `when`
 * guard and no `builderType` worked out from other params, which are functions and only ever live in code.
 */
export type ComponentProp = Pick<
  BuiltinParam,
  'type' | 'description' | 'default' | 'options' | 'required' | 'label' | 'optionLabels' | 'elementType'
>;

/**
 * A reusable subtree of the space: declared once, placed on any page as an instance (a `reference` element with
 * `referenceType: 'component'`), and versioned, published and copied with the space because it is part of it.
 *
 * Its tree is a `flat` of its own rather than roots inside `schema.flat`: that one is the tree of the pages, and a
 * component belongs to none. Ids are still one namespace across every tree, so an id alone says which tree it is in.
 */
export type SpaceComponent = {
  /** The key it is stored under, and what an instance names in `referenceId`. */
  id: string;
  label?: string;
  /** The page folder the builder files it under. It routes nothing: a component has no URL of its own. */
  folder?: string;
  /** What an instance hands in, each as an attribute of the instance; read inside as `{{ props.<name> }}`. */
  props?: Record<string, ComponentProp>;
  /** Elements of `flat` an instance fills with its children, each child naming the one it goes in (`slot`). */
  slots?: Element['id'][];
  rootId: Element['id'];
  /** `rootId` with no parent, and everything under it. */
  flat: Record<Element['id'], Element>;
};

/** What a component declares, apart from its tree: the part an update may change. */
export type SpaceComponentDeclaration = Pick<SpaceComponent, 'label' | 'folder' | 'props' | 'slots'>;

export type Schema = {
  flat: Record<string, Element>;
  definition: { name: string; permanentUrl: string };
  variables: SchemaVariable[];
  /** Keyed by the name each is read by. A space that declares none has none — documents written before flags too. */
  flags?: Record<string, SchemaFlag>;
  settings: {
    keepState?: boolean;
    stateStorage?: 'localStorage' | 'sessionStorage';
    /**
     * Keys of `runtime.state` that are never kept, even with `keepState` on: they are not written, not brought back,
     * and a value one of them already holds survives the moment the rest is restored. For state that must start fresh
     * on every visit — a demo, a panel somebody left open, a step of a walkthrough. Top-level keys, as `setState`
     * writes them.
     */
    transientState?: string[];
    /**
     * Keys of `runtime.state` the first paint depends on — the tool a toolbar shows, a name in an avatar — kept in a
     * cookie as well as in `stateStorage`, so the server renders with them and the page does not swap them in after
     * hydration. Small values only: the cookie travels with every request and holds at most a few kilobytes. Needs
     * `keepState`; a key cannot be both painted and transient. Top-level keys, as `setState` writes them.
     */
    paintedState?: string[];
    customCss: string;
    /**
     * The roles a signed-in visitor may hold in this space, each with the permissions it gives:
     * `{ author: ['postPublish'] }`. They are what an action's `access: 'role'` and a page's `can()` are answered from
     * — a visitor holds exactly the permissions of their roles here, never those of their account anywhere else.
     *
     * Declared by the space, so they are published, versioned and exported with it. WHO holds which is not: that is a
     * list of people, kept by the platform the space runs on, and never part of a document anybody can read.
     */
    visitorRoles?: Record<string, string[]>;
    /** `basic` covers any HTTP+JSON backend by configuration; anything else is a name someone registered. */
    userProvider?: 'basic' | 'custom' | '' | (string & {});
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
     * Where a sign-in that owed a second factor is completed: a password the backend answered with `mfaRequired` and
     * an `mfaToken` resolves `auth.login` to `{ ok: false, reason: 'mfa', mfaToken }`, and `auth.login` with `mode:
     * 'mfa'` posts `{ mfaToken, code }` here and adopts the session it answers with. Leave empty when the backend has
     * no second factor.
     */
    mfaUrl?: string;
    /**
     * What to do on a page that requires a session while the stored one is being re-checked. `optimistic` (the
     * default) renders from the stored session and signs out if the check disagrees; `strict` waits for the answer,
     * trading a round trip for never showing a signed-in page to someone whose session has just ended.
     */
    sessionGate?: 'optimistic' | 'strict';
    /** How old a confirmation may get before the SDK re-checks on the next focus. Defaults to 300. */
    sessionRevalidateSeconds?: number;
    /**
     * Lets the published site open the dev tools — elements, state, interactions — for anybody who visits it.
     *
     * The same `debugMode` the SDK and the page server take, answered by the space: read by a page server that left the
     * decision open. A server that sets its own `debugMode` decides for every space it renders, and an explicit
     * `false` there cannot be turned around from here. Never `devMode`, which makes a deployment a development server.
     */
    debugMode?: boolean;
    /**
     * Values the space computes once and reads everywhere, by name: `{ xp: '{{ state.favourites|length * 10 }}' }` is
     * read as `{{ computed.xp }}` in any binding, attribute or step. Each is a template over the global sources and the
     * values declared before it (`computed.<earlier>`), re-evaluated when any of them changes. A template that is one
     * `{{ expression }}` gives its value (a number, a list); anything else gives text.
     */
    computed?: Record<string, string>;
    /**
     * The realtime channels the space offers, by topic pattern: `{ 'board:{id}': { access: { mode: 'public' } } }`.
     * A page subscribes to and publishes on a topic one of them matches, and on nothing else.
     */
    channels?: ChannelDeclarations;
  };
  rsc?: SchemaRsc;
  pages: Element['id'][];
  pageFolders: PageFolder[];
  components: Record<SpaceComponent['id'], SpaceComponent>;
};

export type SchemaContextValue = {
  definition?: { rootId: string }; // for snippets
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
  schemaRenameElement?: (elementId: Element['id'], id: Element['id'], fromSubscriptions?: boolean) => void;
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
  schemaAddComponent?: (
    component: SpaceComponent,
    from?: { elementId: Element['id']; instanceId: Element['id'] },
    fromSubscriptions?: boolean
  ) => void;
  schemaUpdateComponent?: (
    componentId: SpaceComponent['id'],
    declaration: SpaceComponentDeclaration,
    fromSubscriptions?: boolean
  ) => void;
  schemaRemoveComponent?: (componentId: SpaceComponent['id'], fromSubscriptions?: boolean) => void;
  schemaDetachInstance?: (instanceId: Element['id'], fromSubscriptions?: boolean) => void;
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
  schemaSetFlag?: (name: string, flag: SchemaFlag, fromSubscriptions?: boolean) => void;
  schemaRemoveFlag?: (name: string, fromSubscriptions?: boolean) => void;
  schemaAddSnippet?: (
    to: string,
    data: Element,
    dropPosition?: DropPosition,
    initialItems?: Record<string, Element>,
    style?: SnippetStyle,
    variables?: SchemaVariable[],
    fromSubscriptions?: boolean
  ) => void;
  schemaUpdateSettings?: (value: string | number | boolean, path?: string, fromSubscriptions?: boolean) => void;
};

// Raw

/** The fields of a definition an element may go without — absent in a document, `null` from GraphQL. */
type OptionalDefinitionKey =
  | 'parentId'
  | 'items'
  | 'bindings'
  | 'interactions'
  | 'initialState'
  | 'runtime'
  | 'loadStrategy'
  | 'flag'
  | 'anchor'
  | 'motion'
  | 'quiet';

/**
 * An element as it arrives on the wire. GraphQL answers every field a query names, so one the element does not have
 * comes back `null` — where the element itself has nothing. `schemaFromWire` drops them on arrival.
 */
export type WireElement = Omit<Element, 'definition'> & {
  definition: Omit<ElementDefinition, OptionalDefinitionKey> & {
    [K in Exclude<OptionalDefinitionKey, 'motion'>]?: ElementDefinition[K] | null;
  } & {
    /** Every field the query names, `null` where the motion has none. */
    motion?: { [K in keyof ElementMotion]?: ElementMotion[K] | null } | null;
  };
};

export type SchemaRaw = {
  definition: Schema['definition'];
  flat: WireElement[];
  variables: SchemaVariable[];
  flags?: Schema['flags'];
  settings: Schema['settings'];
  rsc?: Schema['rsc'];
  pages: Element['id'][];
  pageFolders: PageFolder[];
  components: Schema['components'];
};
