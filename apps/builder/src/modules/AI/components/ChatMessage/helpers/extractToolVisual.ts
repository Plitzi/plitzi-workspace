import type { BrandData } from './getBrandResult';
import type { ColorPaletteData } from './getColorPaletteResult';
import type { PreviewData } from './getStagePreviewResult';
import type { StyleGuideData } from './getStyleGuideResult';
import type { WireframeData } from './getWireframeResult';
import type { AiToolCall } from '@pmodules/AI/types';

export const VISUAL_TOOL_NAMES = new Set([
  'render_element',
  'stage_preview',
  'sketch_wireframe',
  'design_color_palette',
  'design_brand_identity',
  'design_style_guide'
]);

export type ToolVisual =
  | { type: 'stage_preview'; data: PreviewData }
  | { type: 'wireframe'; data: WireframeData }
  | { type: 'color_palette'; data: ColorPaletteData }
  | { type: 'brand'; data: BrandData }
  | { type: 'style_guide'; data: StyleGuideData };

const extractToolVisual = (tools: AiToolCall[]): ToolVisual | undefined => {
  for (let i = tools.length - 1; i >= 0; i--) {
    const t = tools[i];
    if (t.status !== 'done' || !t.result) {
      continue;
    }

    if (t.name === 'render_element' || t.name === 'stage_preview') {
      const result = t.result as Omit<PreviewData, 'html'>;

      return { type: 'stage_preview', data: { ...result, html: t.args?.html as string | undefined } };
    }

    if (t.name === 'sketch_wireframe') {
      const result = t.result as Omit<WireframeData, 'html'>;

      return { type: 'wireframe', data: { ...result, html: t.args?.html as string | undefined } };
    }

    if (t.name === 'design_color_palette') {
      return { type: 'color_palette', data: t.result as ColorPaletteData };
    }

    if (t.name === 'design_brand_identity') {
      return { type: 'brand', data: t.result as BrandData };
    }

    if (t.name === 'design_style_guide') {
      return { type: 'style_guide', data: t.result as StyleGuideData };
    }
  }

  return undefined;
};

export default extractToolVisual;
