import { usePopup } from '@plitzi/plitzi-ui/Popup';
import { useCallback, useMemo } from 'react';

import { createStoreDevToolsLogger } from '@plitzi/sdk-shared';
import { createStoreHook } from '@plitzi/sdk-store/createStore';
import StoreProvider from '@plitzi/sdk-store/StoreProvider';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import AITemplateHeader from './AITemplateHeader';

import type { BuilderState, Schema, Style } from '@plitzi/sdk-shared';

export type AITemplatePreviewProps = {
  baseElementId: string;
  schema: Pick<Schema, 'flat'>;
  style: Pick<Style, 'platform' | 'cache'>;
};

const AITemplatePreview = ({ baseElementId, schema, style }: AITemplatePreviewProps) => {
  const { existsPopup, addPopup } = usePopup();
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

  const handleClickExpand = useCallback(() => {
    if (!existsPopup('transform')) {
      addPopup(
        'transform',
        <StoreProvider value={storeValue} logger={createStoreDevToolsLogger('ai-preview')}>
          <BuilderAreaPreview id={baseElementId} className="aspect-video h-full w-full" previewMode />
        </StoreProvider>,
        {
          icon: <i className="fa-brands fa-nfc-symbol text-base" />,
          title: 'Preview',
          height: 400,
          width: 800,
          allowLeftSide: false,
          allowRightSide: false,
          placement: 'floating',
          resizeHandles: ['se']
        }
      );
    }
  }, [addPopup, baseElementId, existsPopup, storeValue]);

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-violet-200 dark:border-violet-900/50">
      <AITemplateHeader baseElementId={baseElementId} onClick={handleClickExpand} />
      <StoreProvider value={storeValue} logger={createStoreDevToolsLogger('ai-preview')}>
        <BuilderAreaPreview id={baseElementId} className="aspect-video h-full w-full" previewMode />
      </StoreProvider>
    </div>
  );
};

export default AITemplatePreview;
