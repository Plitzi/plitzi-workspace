import ContainerAutoScale from '@plitzi/plitzi-ui/ContainerAutoScale';
import { useMemo } from 'react';

import { createStoreDevToolsLogger } from '@plitzi/sdk-shared';
import { createStoreHook, StoreProvider } from '@plitzi/sdk-shared/store';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import type { AiMessagePreview } from '../../types';
import type { BuilderState } from '@plitzi/sdk-shared';

type AiTemplatePreviewProps = Extract<AiMessagePreview, { baseElementId: string }>;

const AiTemplatePreview = ({ baseElementId, schema, style }: AiTemplatePreviewProps) => {
  const { useStore } = createStoreHook<BuilderState>();
  const [[mainSchema, mainStyle, pageDefinitions]] = useStore(['schema', 'style', 'pageDefinitions']);

  const storeValue = useMemo(
    () => ({
      schema: { ...mainSchema, flat: { ...mainSchema.flat, ...schema.flat } },
      style: {
        ...mainStyle,
        platform: {
          desktop: { ...mainStyle.platform.desktop, ...style.platform.desktop },
          tablet: { ...mainStyle.platform.desktop, ...style.platform.tablet },
          mobile: { ...mainStyle.platform.desktop, ...style.platform.mobile }
        },
        cache: `${mainStyle.cache}${style.cache}`
      },
      pageDefinitions
    }),
    [mainSchema, mainStyle, pageDefinitions, schema, style]
  );

  return (
    <StoreProvider value={storeValue} logger={createStoreDevToolsLogger('ai-preview')}>
      <ContainerAutoScale className="flex min-h-40 w-full items-center justify-center overflow-hidden bg-white dark:bg-zinc-950">
        <BuilderAreaPreview id={baseElementId} className="h-full w-full" previewMode />
      </ContainerAutoScale>
    </StoreProvider>
  );
};

export default AiTemplatePreview;
