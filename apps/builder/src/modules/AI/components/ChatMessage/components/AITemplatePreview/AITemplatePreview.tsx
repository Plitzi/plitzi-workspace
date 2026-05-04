/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import { usePopup } from '@plitzi/plitzi-ui/Popup';
import { useCallback, useMemo, useState, use } from 'react';

import { createStoreDevToolsLogger } from '@plitzi/sdk-shared';
import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';
import { createStoreHook } from '@plitzi/sdk-store/createStore';
import StoreProvider from '@plitzi/sdk-store/StoreProvider';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import AITemplateHeader from './AITemplateHeader';

import type { BuilderState, DisplayMode, Schema, Style } from '@plitzi/sdk-shared';

export type AITemplatePreviewProps = {
  baseElementId: string;
  schema?: Pick<Schema, 'flat'>;
  style?: Pick<Style, 'platform' | 'cache'>;
  html?: string;
};

const AITemplatePreview = ({ baseElementId, schema, style, html }: AITemplatePreviewProps) => {
  const { theme } = use(ThemeContext);
  const { existsPopup, addPopup } = usePopup();
  const { useStore } = createStoreHook<BuilderState>();
  const [[mainSchema, mainStyle, pageDefinitions]] = useStore(['schema', 'style', 'pageDefinitions']);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('desktop');
  const [showHtml, setShowHtml] = useState(false);

  const storeValue = useMemo(
    () => ({
      schema: {
        ...mainSchema,
        flat: { ...mainSchema.flat, ...(schema?.flat ?? {}) }
      },
      style: {
        ...mainStyle,
        platform: {
          desktop: { ...mainStyle.platform.desktop, ...(style?.platform?.desktop ?? {}) },
          tablet: { ...mainStyle.platform.tablet, ...(style?.platform?.tablet ?? {}) },
          mobile: { ...mainStyle.platform.mobile, ...(style?.platform?.mobile ?? {}) }
        },
        cache: `${mainStyle.cache}${style?.cache ?? ''}`
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
          width: 400,
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
      <AITemplateHeader
        baseElementId={baseElementId}
        displayMode={displayMode}
        onDisplayMode={setDisplayMode}
        onClick={handleClickExpand}
        showHtml={showHtml}
        onToggleHtml={() => setShowHtml(prev => !prev)}
        hasHtml={!!html}
      />

      {showHtml && html ? (
        <CodeMirror
          value={html}
          theme={theme === 'dark' ? 'dark' : 'light'}
          size="xs"
          className="h-full max-h-60 overflow-auto"
          readOnly
        />
      ) : (
        <div className="flex justify-center overflow-hidden bg-zinc-50 dark:bg-zinc-900">
          <StoreProvider value={storeValue} logger={createStoreDevToolsLogger('ai-preview')}>
            <BuilderAreaPreview id={baseElementId} className="aspect-video h-full w-full" previewMode />
          </StoreProvider>
        </div>
      )}
    </div>
  );
};

export default AITemplatePreview;
