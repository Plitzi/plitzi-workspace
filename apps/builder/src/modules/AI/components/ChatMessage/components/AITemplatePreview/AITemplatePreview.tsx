import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import { usePopup } from '@plitzi/plitzi-ui/Popup';
import { useCallback, useMemo, useState, use } from 'react';

import { createStoreDevToolsLogger } from '@plitzi/sdk-shared';
import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';
import StoreProvider from '@plitzi/sdk-store/StoreProvider';
import BuilderAreaPreview from '@pmodules/Builder/components/BuilderAreaPreview';

import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

import AITemplateHeader from './AITemplateHeader';

import type { AiMode } from '@pmodules/AI/types';
import type { DisplayMode, Schema, Style } from '@plitzi/sdk-shared';

export type AITemplatePreviewProps = {
  baseElementId: string;
  schema?: Pick<Schema, 'flat'>;
  style?: Pick<Style, 'platform' | 'cache'>;
  html?: string;
  mode?: AiMode;
};

const AITemplatePreview = ({ baseElementId, schema, style, html, mode }: AITemplatePreviewProps) => {
  const { theme } = use(ThemeContext);
  const { existsPopup, addPopup } = usePopup();
  const { onSendMessage, elementSelected } = useAiChatContext();
  const [displayMode, setDisplayMode] = useState<DisplayMode>('desktop');
  const [showHtml, setShowHtml] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [target, setTarget] = useState<'page' | 'element'>('page');

  const storeValue = useMemo(() => ({ schema, style }), [schema, style]);

  const handleClickExpand = useCallback(() => {
    if (!existsPopup('transform')) {
      addPopup(
        'transform',
        <StoreProvider value={storeValue} logger={createStoreDevToolsLogger('ai-preview')}>
          <BuilderAreaPreview id={baseElementId} className="aspect-video h-full w-full" previewMode />
        </StoreProvider>,
        {
          icon: <i className="fa-brands fa-nfc-symbol text-base" />,
          title: 'Preview', height: 400, width: 400,
          allowLeftSide: false, allowRightSide: false,
          placement: 'floating', resizeHandles: ['se']
        }
      );
    }
  }, [addPopup, baseElementId, existsPopup, storeValue]);

  const handleConfirm = useCallback(() => {
    const where = target === 'element' && elementSelected
      ? `as children of the currently selected element (ID: "${elementSelected}")`
      : 'on the current page';
    onSendMessage(
      `The user has approved the proposed layout (element: ${baseElementId}). Please apply it ${where} permanently using the appropriate tool (createElement or applyToPage).`
    );
    setConfirming(false);
  }, [baseElementId, target, elementSelected, onSendMessage]);

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-violet-200 text-xs dark:border-violet-900/50">
      <AITemplateHeader
        baseElementId={baseElementId}
        displayMode={displayMode}
        onDisplayMode={setDisplayMode}
        onClick={handleClickExpand}
        showHtml={showHtml}
        onToggleHtml={() => setShowHtml(prev => !prev)}
        hasHtml={!!html}
        mode={mode}
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

      {/* Confirmation panel */}
      {confirming && (
        <div className="border-t border-violet-100 bg-violet-50/60 px-3 py-2 dark:border-violet-900/30 dark:bg-violet-950/20">
          <p className="mb-1.5 font-mono text-[10px] text-zinc-600 dark:text-zinc-300">Apply layout to:</p>
          <div className="mb-2 flex gap-1">
            <button
              onClick={() => setTarget('page')}
              className={`rounded border px-2 py-0.5 font-mono text-[10px] ${target === 'page' ? 'border-violet-400 bg-violet-100 text-violet-700 dark:border-violet-600 dark:bg-violet-900/40 dark:text-violet-300' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400'}`}
            >
              Current Page
            </button>
            {elementSelected && (
              <button
                onClick={() => setTarget('element')}
                className={`rounded border px-2 py-0.5 font-mono text-[10px] ${target === 'element' ? 'border-violet-400 bg-violet-100 text-violet-700 dark:border-violet-600 dark:bg-violet-900/40 dark:text-violet-300' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400'}`}
              >
                Selected Element
              </button>
            )}
          </div>
          {target === 'element' && elementSelected && (
            <p className="mb-1.5 font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
              Will be added as children of <span className="text-violet-500">"{elementSelected}"</span>
            </p>
          )}
          <p className="mb-2 font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
            The AI will commit this proposed element permanently.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="rounded border border-zinc-200 px-2.5 py-1 font-mono text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="rounded bg-violet-600 px-2.5 py-1 font-mono text-white hover:bg-violet-700"
            >
              Confirm & Apply
            </button>
          </div>
        </div>
      )}

      {!confirming && (
        <div className="flex items-center justify-end border-t border-violet-100 bg-violet-50/50 px-3 py-1.5 dark:border-violet-900/30 dark:bg-violet-950/20">
          <button
            onClick={() => setConfirming(true)}
            className="rounded border border-violet-300 px-2.5 py-1 font-mono text-violet-600 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950/40"
          >
            Apply to Page
          </button>
        </div>
      )}
    </div>
  );
};

export default AITemplatePreview;
