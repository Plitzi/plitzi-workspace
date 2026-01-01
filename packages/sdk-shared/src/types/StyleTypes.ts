import type { StyleConstants } from '../style/styleConstants';

export type TagType = 'class' | 'element' | 'id' | 'state' | 'parent';

export type DisplayMode = 'desktop' | 'tablet' | 'mobile';

export type StyleScheme = 'default' | 'light' | 'dark';

export type StyleVariableCategory = 'color' | 'spacing' | 'shadow';
// | 'radius'
// | 'typography'
// | 'border'
// | 'motion'
// | 'z-index';

export type StyleMode = 'mobile-first' | 'desktop-first';

export type StyleValue = number | string;

export type StyleCategory = (typeof StyleConstants)[keyof typeof StyleConstants];

export type StyleVariableValues = Record<StyleScheme, string>;
export type StyleVariable = Record<string, StyleVariableValues>;
export type StyleVariables = Record<StyleVariableCategory, StyleVariable>;

export type StyleBaseItem = {
  name: string;
  attributes?: Partial<Record<StyleCategory, StyleValue>>;
  variables: Partial<StyleVariables>;
  cache: string;
};

export type StyleItem = StyleBaseItem & { type: TagType };

export type StylePlatform = Record<DisplayMode, Record<string, StyleItem>>;

export type Style = {
  variables: Partial<StyleVariables>;
  platform: StylePlatform;
  theme: { default: 'system'; schemes: StyleScheme[] };
  mode?: StyleMode;
  cache: string;
};

export type StyleContextValue = { style: Style };
