import type { Schema, Style } from '@plitzi/sdk-shared';

export type BrandTypeface = {
  family: string;
  weight?: string;
  tracking?: string;
};

export type BrandData = {
  name: string;
  tagline?: string;
  personality: string[];
  colors: {
    primary: string;
    secondary?: string;
    accent?: string;
    background?: string;
    surface?: string;
    text?: string;
  };
  colorsDark?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    surface?: string;
    text?: string;
  };
  typography?: {
    heading: BrandTypeface;
    body: BrandTypeface;
  };
  voice?: {
    tone: string;
    keywords?: string[];
  };
};

export type ColorItem = {
  name: string;
  hex: string;
  darkHex?: string;
  role?: string;
};

export type ColorPaletteData = {
  name: string;
  description?: string;
  colors: ColorItem[];
};

export type PreviewData = {
  baseElementId: string;
  schema?: Pick<Schema, 'flat'>;
  style?: Pick<Style, 'platform' | 'cache'>;
  elements?: Array<Record<string, unknown>>;
  html?: string;
};

export type WireframeData = {
  baseElementId: string;
  name: string;
  description?: string;
  schema?: Pick<Schema, 'flat'>;
  style?: Pick<Style, 'platform' | 'cache'>;
  html?: string;
};

export type NamedToken = { name: string; value: string };
export type ColorScale = Record<string, string>;

export type StyleGuideData = {
  name: string;
  description?: string;
  colors: {
    primary: ColorScale;
    secondary?: ColorScale;
    accent?: ColorScale;
    neutral?: ColorScale;
    semantic?: {
      success?: string;
      warning?: string;
      error?: string;
      info?: string;
    };
  };
  colorsDark?: {
    primary?: ColorScale;
    secondary?: ColorScale;
    accent?: ColorScale;
    neutral?: ColorScale;
  };
  typography?: {
    fontFamily: { heading: string; body: string };
    scale?: Array<{ name: string; size: string; lineHeight: string; weight?: string }>;
  };
  spacing?: NamedToken[];
  borderRadius?: NamedToken[];
  shadows?: NamedToken[];
};
