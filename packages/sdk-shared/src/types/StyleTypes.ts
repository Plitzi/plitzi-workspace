import type { StyleConstants } from '../style/styleConstants';

export type TagType = 'class' | 'element' | 'id' | 'state' | 'parent';

export type DisplayMode = 'desktop' | 'tablet' | 'mobile';

export type StyleValue = number | string;

export type StyleCategory = (typeof StyleConstants)[keyof typeof StyleConstants];

export type StyleBaseItem = {
  name: string;
  attributes: { [key in StyleCategory]?: StyleValue };
  cache: string;
};

export type StyleItem = StyleBaseItem & { type: TagType };

export type StylePlatform = Record<DisplayMode, Record<string, StyleItem>>;

export type Style = {
  variables: { [key: string]: string };
  platform: StylePlatform;
  cache: string;
};

export type StyleContextValue = { style: Style };
