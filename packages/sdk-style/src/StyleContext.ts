import { createContext } from 'react';

import { EMPTY_STYLE_SCHEMA } from './StyleHelper';

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

export type StyleContextValue = Style;

const styleContextDefaultValue: StyleContextValue = EMPTY_STYLE_SCHEMA;

const StyleContext = createContext<StyleContextValue | undefined>(styleContextDefaultValue);

export default StyleContext;
