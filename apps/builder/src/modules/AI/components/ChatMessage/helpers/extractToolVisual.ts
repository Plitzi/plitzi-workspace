import type { BrandData, ColorPaletteData, PreviewData, StyleGuideData, WireframeData } from './toolVisualTypes';
import type { Schema, Style } from '@plitzi/sdk-shared';
import type { AiToolCall } from '@pmodules/AI/types';

type RenderElementData = {
  elementId: string;
  schema?: Pick<Schema, 'flat'>;
  style?: Pick<Style, 'platform' | 'cache'>;
};

// ask_question is intentionally NOT here: it is answered in the input-area slot (QuestionInput),
// not rendered inline in the transcript.
export const VISUAL_TOOL_NAMES = new Set([
  'preview_element',
  'preview_concept',
  'sketch_wireframe',
  'design_color_palette',
  'design_brand_identity',
  'design_style_guide'
]);

export type ToolVisual =
  | { type: 'preview_element'; data: RenderElementData }
  | { type: 'preview_concept'; data: PreviewData }
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

    if (t.name === 'preview_element') {
      const result = t.result as {
        baseElementId: string;
        schema?: Pick<Schema, 'flat'>;
        style?: Pick<Style, 'platform' | 'cache'>;
      };
      // Only overlay the rendered schema when the agent proposed overrides; otherwise render the
      // live element so unsaved edits still show.
      const hasOverrides = !!(t.args && 'overrides' in t.args && t.args.overrides);

      return {
        type: 'preview_element',
        data: {
          elementId: result.baseElementId,
          schema: hasOverrides ? result.schema : undefined,
          style: hasOverrides ? result.style : undefined
        }
      };
    }

    if (t.name === 'preview_concept') {
      const result = t.result as Omit<PreviewData, 'html'>;

      return { type: 'preview_concept', data: { ...result, html: t.args?.html as string | undefined } };
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
