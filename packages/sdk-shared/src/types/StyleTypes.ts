import type { ColorScheme, Theme } from './ThemeTypes';
import type styleConstants from '../style/styleConstants';
import type { StylePseudo } from '../style/stylePseudos';
import type { STYLE_STATES } from '../style/styleStates';

export type TagType = 'class' | 'element' | 'id';
export type DisplayMode = 'desktop' | 'tablet' | 'mobile';
export type StyleMode = 'mobile-first' | 'desktop-first';
export type StyleState = (typeof STYLE_STATES)[number];
export type StyleValue = number | string;

// ======== Themes/Variables ========

export type StyleCategory = (typeof styleConstants)[keyof typeof styleConstants];
export enum StyleVariableCategory {
  COLOR = 'color',
  SPACING = 'spacing',
  SHADOW = 'shadow',
  CUSTOM = 'custom'
  // RADIUS = 'radius',
  // TYPOGRAPHY = 'typography',
  // BORDER = 'border',
  // Z_INDEX = 'z-index',
}

const STYLE_VARIABLE_CATEGORIES: readonly string[] = Object.values(StyleVariableCategory);

export const isStyleVariableCategory = (value: unknown): value is StyleVariableCategory =>
  typeof value === 'string' && STYLE_VARIABLE_CATEGORIES.includes(value);

export type StyleThemeValue = Partial<Record<ColorScheme | 'default', string>>;
export type StyleVariableValue = string | number | StyleThemeValue;
export type StyleVariableGroup = Record<string, StyleVariableValue>;
export type StyleVariables = Record<StyleVariableCategory, StyleVariableGroup>;

//  ======== End Themes/Variables ========

// Base CSS-like object
export type StyleObject = Partial<Record<StyleCategory, StyleValue>>;

// States (hover, active, etc)
export type StyleStates = Partial<Record<StyleState, StyleObject>>;

// The rules of one target and of its states: what a pseudo-element, an ancestor's variant and every other part hold.
export type StyleStateBlock = { default?: StyleObject; states?: StyleStates };

export type { StylePseudo };

// Pseudo-elements (`::before`, `::placeholder`…): what the class draws or dresses besides the element, in its states.
export type StylePseudos = Partial<Record<StylePseudo, StyleStateBlock>>;

// Variants (sm, lg, primary): their rules, their states and their pseudo-elements.
export type StyleVariant = StyleStateBlock & { pseudos?: StylePseudos };
export type StyleVariants = Record<string, StyleVariant>;

// How the element looks inside an ancestor carrying that class: always (`default`), or while that ancestor is in a
// state or variant (a card's hover, a collapsed sidebar). Keyed by the ancestor's class name; any ancestor counts,
// not only the parent. `PARENT_ANCESTOR` (`>`) is the parent, whatever it wears, in its states.
export type StyleAncestor = { default?: StyleObject; states?: StyleStates; variants?: Record<string, StyleStateBlock> };
export type StyleAncestors = Record<string, StyleAncestor>;

// Rules under a condition of the page rather than the element (`motion-reduce`, `container (max-width: 30rem)` — see
// `styleConditions`): the class's own, its states' and its pseudo-elements'.
export type StyleCondition = StyleStateBlock & { pseudos?: StylePseudos };
export type StyleConditions = Record<string, StyleCondition>;

// Full block per selector (base, header, etc)
export type StyleBlock = {
  default?: StyleObject;
  states?: StyleStates;
  variants?: StyleVariants;
  ancestors?: StyleAncestors;
  pseudos?: StylePseudos;
  conditions?: StyleConditions;
};

// Which part of a selector an edit addresses. With `styleAncestor`, state and variant are the ancestor's, and
// neither means inside that ancestor at all times. `styleCondition` and `styleAncestor` exclude each other, and a
// condition has no variants; `stylePseudo` is the pseudo-element of whichever of them is addressed, and `styleState`
// then the state it shows in.
export type StyleTarget = {
  componentType?: string;
  styleSelector?: string;
  styleState?: StyleState;
  styleVariant?: string;
  styleAncestor?: string;
  stylePseudo?: StylePseudo;
  styleCondition?: string;
};

// styleSelector: base, header, icon, etc
export type StyleAttributes = Record<string, StyleBlock>;

export type StyleItem = {
  name: string;
  type: TagType;
  variables?: Partial<StyleVariables>;
  attributes: StyleAttributes;
  cache: string;
  componentType?: string;
};

// ======== Fonts ========

export type FontSource = 'system' | 'google' | 'remote' | 'hosted';
export type FontStyle = 'normal' | 'italic';
export type FontDisplay = 'auto' | 'block' | 'swap' | 'fallback' | 'optional';

/** One face of a family: the file carrying a given weight and slant. */
export type FontFace = {
  weight: number;
  style: FontStyle;
  format: 'woff2' | 'woff';
  /** Limits the face to the code points it covers, so the browser fetches it only when needed. */
  unicodeRange?: string;
};

export type FontBase = {
  /** What `font-family` names. Unique within a space. */
  family: string;
  /** Appended to the stack — `'Lato', sans-serif` — and what renders while the face loads. */
  fallback: string;
  /** The weights the family really provides: what the picker offers, and what it disables against. */
  weights: number[];
  styles: FontStyle[];
  display?: FontDisplay;
  /** Worth a `<link rel="preload">`. The body family, and at most one more: preloading everything
   *  is the same as preloading nothing. */
  preload?: boolean;
};

/** Installed nowhere: a stack the visitor's system already has. Costs no bytes. */
export type SystemFont = FontBase & { source: 'system' };

/** Google Fonts, reached through the single aggregated `css2` request the resolver builds. */
export type GoogleFont = FontBase & { source: 'google'; subsets?: string[] };

/** Someone else's origin — Adobe Fonts, Bunny, Fontshare, the customer's own CDN. Either a
 *  stylesheet that declares the faces, or the files themselves. */
export type RemoteFont = FontBase & {
  source: 'remote';
  stylesheet?: string;
  files?: (FontFace & { url: string })[];
};

/** Uploaded to this deployment's font store. `path` is store-relative and never absolute: a
 *  manifest that carried `https://cdn.plitzi.com/...` would follow a space onto a server that is
 *  not ours and keep asking Plitzi for its fonts. The URL is made at render time. */
export type HostedFont = FontBase & { source: 'hosted'; files: (FontFace & { path: string })[] };

export type SpaceFont = SystemFont | GoogleFont | RemoteFont | HostedFont;

/** What a surface needs to put in its `<head>` for a manifest — see `fontsToHead`. */
export type FontHead = {
  /** `crossorigin` where the origin serves the FILES: a font is fetched in CORS mode, and a preconnect that
   *  omits it warms a connection the font fetch then cannot use. A stylesheet origin takes it off. */
  preconnect: { href: string; crossorigin?: boolean }[];
  links: { href: string; rel: 'stylesheet' | 'preload'; as?: 'style' | 'font'; type?: string; crossorigin?: boolean }[];
  /** `@font-face` blocks, as CSS text. Empty when every family is system or linked. */
  faces: string;
  /** Every origin the manifest reaches for, for a CSP that has to name them. */
  origins: string[];
};

//  ======== End Fonts ========

export type Style = {
  platform: Record<DisplayMode, Record<string, StyleItem>>;
  mode?: StyleMode;
  theme: { default: Theme; schemes: Theme[] };
  variables: Partial<StyleVariables>;
  /** The families this space declares. A `font-family` naming anything absent from here renders in a fallback,
   *  because nothing else in the system loads a face. Optional because a document written before the manifest
   *  existed has none, and that is a real state every reader has to survive rather than a bug. */
  fonts?: SpaceFont[];
  cache: string;
};

export type StyleContextValue = {
  styleUpdate?: unknown;
  styleAddSelector?: unknown;
  styleUpdateSelector?: unknown;
  styleRemoveSelector?: unknown;
  styleRemoveSelectors?: unknown;
  styleAddSelectorVariable?: unknown;
  styleUpdateSelectorVariable?: unknown;
  styleRemoveSelectorVariable?: unknown;
  styleAddVariable?: unknown;
  styleUpdateVariable?: unknown;
  styleRemoveVariable?: unknown;
  styleAddFont?: unknown;
  styleUpdateFont?: unknown;
  styleRemoveFont?: unknown;
  styleAddSnippet?: unknown;
  styleUpdateSettings?: unknown;
};
