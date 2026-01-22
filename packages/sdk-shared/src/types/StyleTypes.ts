import type { StyleConstants } from '../style/styleConstants';

export type TagType = 'class' | 'element' | 'id' | 'state' | 'parent';

export type DisplayMode = 'desktop' | 'tablet' | 'mobile';

export type StyleMode = 'mobile-first' | 'desktop-first';

export type StyleValue = number | string;

export type StyleCategory = (typeof StyleConstants)[keyof typeof StyleConstants];

// Themes/Variables

export type StyleThemeMode = 'system' | 'light' | 'dark';
export enum StyleVariableCategory {
  COLOR = 'color',
  SPACING = 'spacing',
  SHADOW = 'shadow',
  CUSTOM = 'custom'
  // RADIUS = 'radius',
  // TYPOGRAPHY = 'typography',
  // BORDER = 'border',
  // ZINDEX = 'z-index',
}

export type StyleThemeValue = Partial<Record<Exclude<StyleThemeMode, 'system'> | 'default', string>>;
export type StyleVariableValue = string | number | StyleThemeValue;
export type StyleVariableGroup = Record<string, StyleVariableValue>;
export type StyleVariables = Record<StyleVariableCategory, StyleVariableGroup>;

// End Themes/Variables

export type StyleBaseItem = {
  name: string;
  attributes: Partial<Record<StyleCategory, StyleValue>>;
  variables?: Partial<StyleVariables>;
  cache: string;
};

export type StyleItem = StyleBaseItem & { type: TagType };

export type StylePlatform = Record<DisplayMode, Record<string, StyleItem>>;

export type Style = {
  platform: StylePlatform;
  mode?: StyleMode;
  theme: { default: StyleThemeMode; schemes: StyleThemeMode[] };
  variables: Partial<StyleVariables>;
  cache: string;
};

export type StyleContextValue = { style: Style };
