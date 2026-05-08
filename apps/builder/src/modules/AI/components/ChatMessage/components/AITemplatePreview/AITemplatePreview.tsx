import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import { usePopup } from '@plitzi/plitzi-ui/Popup';
import { useCallback, useMemo, useState, use } from 'react';

import { createStoreDevToolsLogger } from '@plitzi/sdk-shared';
import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';
import StoreProvider from '@plitzi/sdk-store/StoreProvider';
import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import AITemplateHeader from './components/AITemplateHeader';
import ConfirmPanel from './components/ConfirmPanel';

import type { DisplayMode, Schema, Style } from '@plitzi/sdk-shared';
import type { AiMode } from '@pmodules/AI/types';

export type AITemplatePreviewProps = {
  baseElementId: string;
  schema?: Pick<Schema, 'flat'>;
  style?: Pick<Style, 'platform' | 'cache'>;
  html?: string;
  mode?: AiMode;
  version?: number;
};

const AITemplatePreview = ({ baseElementId, schema, style, html, mode, version }: AITemplatePreviewProps) => {
  const { theme } = use(ThemeContext);
  const { existsPopup, addPopup } = usePopup();
  const { onSendMessage, elementSelected } = useAiChatContext();
  const [displayMode, setDisplayMode] = useState<DisplayMode>('desktop');
  const [showHtml, setShowHtml] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [target, setTarget] = useState<'page' | 'element'>('page');

  const storeValue = useMemo(() => ({ schema, style }), [schema, style]);

  const handleToggleHtml = useCallback(() => setShowHtml(prev => !prev), []);
  const handleStartConfirm = useCallback(() => setConfirming(true), []);
  const handleCancel = useCallback(() => setConfirming(false), []);
  const handleTargetPage = useCallback(() => setTarget('page'), []);
  const handleTargetElement = useCallback(() => setTarget('element'), []);

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

  const handleConfirm = useCallback(() => {
    const where =
      target === 'element' && elementSelected
        ? `as children of the currently selected element (ID: "${elementSelected}")`
        : 'on the current page';

    onSendMessage(
      `The user has approved the proposed layout (element: ${baseElementId}). Please apply it ${where} permanently using the appropriate tool (createElement or applyToPage).`
    );
    setConfirming(false);
  }, [baseElementId, target, elementSelected, onSendMessage]);

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-zinc-200 text-xs dark:border-zinc-700/60">
      <AITemplateHeader
        baseElementId={baseElementId}
        displayMode={displayMode}
        onDisplayMode={setDisplayMode}
        onClick={handleClickExpand}
        showHtml={showHtml}
        onToggleHtml={handleToggleHtml}
        hasHtml={!!html}
        mode={mode}
        version={version}
      />

      {showHtml && html && (
        <CodeMirror
          value={html}
          theme={theme === 'dark' ? 'dark' : 'light'}
          size="xs"
          className="h-full max-h-60 overflow-auto"
          readOnly
        />
      )}
      {(!showHtml || !html) && (
        <div className="flex justify-center overflow-hidden bg-zinc-50 dark:bg-zinc-900">
          <StoreProvider value={storeValue} logger={createStoreDevToolsLogger('ai-preview')}>
            <BuilderAreaPreview id={baseElementId} className="aspect-video h-full w-full" previewMode />
          </StoreProvider>
        </div>
      )}

      <ConfirmPanel
        confirming={confirming}
        target={target}
        elementSelected={elementSelected}
        onStartConfirm={handleStartConfirm}
        onCancel={handleCancel}
        onTargetPage={handleTargetPage}
        onTargetElement={handleTargetElement}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default AITemplatePreview;
