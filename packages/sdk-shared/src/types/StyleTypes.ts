export type TagType = 'class' | 'element' | 'id' | 'state' | 'parent';

export type DisplayMode = 'desktop' | 'tablet' | 'mobile';

export type StyleValue = number | string;

export type StyleItem = {
  name: string;
  attributes: { [key: string]: StyleValue };
  cache: string;
  type: TagType;
};

export type StylePlatform = Record<DisplayMode, Record<string, StyleItem>>;

export type Style = {
  variables: { [key: string]: string };
  platform: StylePlatform;
  cache: string;
};
