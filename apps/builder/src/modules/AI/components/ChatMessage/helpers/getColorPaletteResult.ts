import type { AiMessage } from '@pmodules/AI/types';

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

const getColorPaletteResult = (tools?: AiMessage['tools']): ColorPaletteData | undefined => {
  const tool = tools?.findLast(t => t.name === 'design_color_palette' && t.status === 'done');
  if (!tool?.result) {
    return undefined;
  }

  return tool.result as ColorPaletteData;
};

export default getColorPaletteResult;
