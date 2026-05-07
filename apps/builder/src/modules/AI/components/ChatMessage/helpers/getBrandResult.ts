import type { AiMessage } from '@pmodules/AI/types';

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

const getBrandResult = (tools?: AiMessage['tools']): BrandData | undefined => {
  const tool = tools?.findLast(t => t.name === 'design_brand_identity' && t.status === 'done');
  if (!tool?.result) {
    return undefined;
  }

  return tool.result as BrandData;
};

export default getBrandResult;
