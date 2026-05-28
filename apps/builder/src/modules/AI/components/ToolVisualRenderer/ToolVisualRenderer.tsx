import AIBrandPreview from '@pmodules/AI/components/ChatMessage/components/AIBrandPreview';
import AIColorPalettePreview from '@pmodules/AI/components/ChatMessage/components/AIColorPalettePreview';
import AIStyleGuidePreview from '@pmodules/AI/components/ChatMessage/components/AIStyleGuidePreview';
import AITemplatePreview from '@pmodules/AI/components/ChatMessage/components/AITemplatePreview';
import AIWireframePreview from '@pmodules/AI/components/ChatMessage/components/AIWireframePreview';
import SdkElementPreview from '@pmodules/AI/components/ChatMessage/components/SdkElementPreview';

import type { ToolVisual } from '@pmodules/AI/components/ChatMessage/helpers/extractToolVisual';
import type { AiMode } from '@pmodules/AI/types';

export type ToolVisualRendererProps = {
  visual: ToolVisual;
  mode?: AiMode;
  stagePreviewVersion?: number;
  wireframeVersion?: number;
};

const ToolVisualRenderer = ({ visual, mode, stagePreviewVersion, wireframeVersion }: ToolVisualRendererProps) => {
  if (visual.type === 'style_guide') {
    return <AIStyleGuidePreview {...visual.data} mode={mode} />;
  }

  if (visual.type === 'brand') {
    return <AIBrandPreview {...visual.data} mode={mode} />;
  }

  if (visual.type === 'color_palette') {
    return <AIColorPalettePreview {...visual.data} mode={mode} />;
  }

  if (visual.type === 'wireframe') {
    return <AIWireframePreview {...visual.data} mode={mode} version={wireframeVersion} />;
  }

  if (visual.type === 'render_element') {
    return <SdkElementPreview elementId={visual.data.elementId} />;
  }

  return (
    <AITemplatePreview
      baseElementId={visual.data.baseElementId}
      schema={visual.data.schema}
      style={visual.data.style}
      html={visual.data.html}
      mode={mode}
      version={stagePreviewVersion}
    />
  );
};

export default ToolVisualRenderer;
