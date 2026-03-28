import type styleConstants from '../style/styleConstants';

export type TagType = 'class' | 'element' | 'id';
export type DisplayMode = 'desktop' | 'tablet' | 'mobile';
export type StyleMode = 'mobile-first' | 'desktop-first';
export type StyleState = 'hover' | 'active' | 'focus' | 'disabled';
export type StyleValue = number | string;

// ======== Themes/Variables ========

export type StyleThemeMode = 'system' | 'light' | 'dark';
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

export type StyleThemeValue = Partial<Record<Exclude<StyleThemeMode, 'system'> | 'default', string>>;
export type StyleVariableValue = string | number | StyleThemeValue;
export type StyleVariableGroup = Record<string, StyleVariableValue>;
export type StyleVariables = Record<StyleVariableCategory, StyleVariableGroup>;

//  ======== End Themes/Variables ========

// Base CSS-like object
export type StyleObject = Partial<Record<StyleCategory, StyleValue>>;

// States (hover, active, etc)
export type StyleStates = Partial<Record<StyleState, StyleObject>>;

// Variants (sm, lg, primary)
export type StyleVariants = Record<string, Omit<StyleBlock, 'variants'>>;

// Full block per selector (base, header, etc)
export type StyleBlock = { default?: StyleObject; states?: StyleStates; variants?: StyleVariants };

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

export type Style = {
  platform: Record<DisplayMode, Record<string, StyleItem>>;
  mode?: StyleMode;
  theme: { default: StyleThemeMode; schemes: StyleThemeMode[] };
  variables: Partial<StyleVariables>;
  cache: string;
};

export type StyleContextValue = { style: Style };
