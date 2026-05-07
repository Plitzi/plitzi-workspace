import type { AiMessage } from '@pmodules/AI/types';

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

const getStyleGuideResult = (tools?: AiMessage['tools']): StyleGuideData | undefined => {
  const tool = tools?.findLast(t => t.name === 'design_style_guide' && t.status === 'done');
  if (!tool?.result) {
    return undefined;
  }

  return tool.result as StyleGuideData;
};

export default getStyleGuideResult;
