import type styleConstants from '../style/styleConstants';

export type TagType = 'class' | 'element' | 'id' | 'state' | 'parent';

export type DisplayMode = 'desktop' | 'tablet' | 'mobile';

export type StyleMode = 'mobile-first' | 'desktop-first';

export type StyleValue = number | string;

// Themes/Variables

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

// End Themes/Variables

export type StyleItem = {
  name: string;
  type: TagType;
  attributes: Partial<Record<StyleCategory, StyleValue>>;
  variables?: Partial<StyleVariables>;
  cache: string;
};

export type StylePlatform = Record<DisplayMode, Record<string, StyleItem>>;

export type Style = {
  platform: StylePlatform;
  mode?: StyleMode;
  theme: { default: StyleThemeMode; schemes: StyleThemeMode[] };
  variables: Partial<StyleVariables>;
  cache: string;
};

export type StyleContextValue = { style: Style };
