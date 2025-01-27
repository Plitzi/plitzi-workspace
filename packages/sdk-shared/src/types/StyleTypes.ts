export type TagType = 'class' | 'element' | 'id' | 'state' | 'parent';

export type StyleItem = {
  name: string;
  attributes: { [key: string]: string };
  cache: string;
  type: TagType;
};

export type StylePlatform = {
  [key: string]: { [key: string]: StyleItem | undefined };
};

export type Style = {
  variables: { [key: string]: string };
  platform: StylePlatform;
  cache: string;
};
