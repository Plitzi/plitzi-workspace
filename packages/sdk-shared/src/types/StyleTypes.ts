import type { StyleConstants } from '../style/styleConstants';

export type TagType = 'class' | 'element' | 'id' | 'state' | 'parent';

export type DisplayMode = 'desktop' | 'tablet' | 'mobile';

export type StyleMode = 'mobile-first' | 'desktop-first';

export type StyleValue = number | string;

export type StyleCategory = (typeof StyleConstants)[keyof typeof StyleConstants];

// Themes/Variables

export type ThemeMode = 'system' | 'light' | 'dark';
export type VariableCategory = 'color' | 'spacing' | 'shadow';
// | 'radius'
// | 'typography'
// | 'border'
// | 'motion'
// | 'z-index';
export type ThemeValue = Partial<Record<Exclude<ThemeMode, 'system'> | 'default', string>>;
export type VariableValue = string | number | ThemeValue;
export type VariableGroup = Record<string, VariableValue>;
export type StyleVariables = Record<VariableCategory, VariableGroup>;

// End Themes/Variables

export type StyleBaseItem = {
  name: string;
  attributes?: Partial<Record<StyleCategory, StyleValue>>;
  variables: Partial<StyleVariables>;
  cache: string;
};

export type StyleItem = StyleBaseItem & { type: TagType };

export type StylePlatform = Record<DisplayMode, Record<string, StyleItem>>;

export type Style = {
  platform: StylePlatform;
  mode?: StyleMode;
  theme: { default: ThemeMode; schemes: ThemeMode[] };
  variables: Partial<StyleVariables>;
  cache: string;
};

export type StyleContextValue = { style: Style };
