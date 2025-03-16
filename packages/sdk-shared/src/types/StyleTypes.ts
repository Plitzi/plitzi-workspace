import type { StyleConstants } from '../style/StyleConstants';

export type TagType = 'class' | 'element' | 'id' | 'state' | 'parent';

export type DisplayMode = 'desktop' | 'tablet' | 'mobile';

export type StyleValue = number | string;

export type StyleCategory = (typeof StyleConstants)[keyof typeof StyleConstants];

export type StyleItem = {
  name: string;
  attributes: { [key in StyleCategory]?: StyleValue };
  cache: string;
  type: TagType;
};

export type StylePlatform = Record<DisplayMode, Record<string, StyleItem>>;

export type Style = {
  variables: { [key: string]: string };
  platform: StylePlatform;
  cache: string;
};
