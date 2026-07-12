import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import { usePopup } from '@plitzi/plitzi-ui/Popup';
import clsx from 'clsx';
import { useCallback, useState, use } from 'react';

import { ThemeContext } from '@plitzi/sdk-shared/theme/ThemeProvider';
import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

import { PLACEHOLDER } from './helpers';

import type { WireframeData } from '../../helpers/toolVisualTypes';
import type { Element, Schema } from '@plitzi/sdk-shared';
import type { AiMode } from '@pmodules/AI/types';

export type AIWireframePreviewProps = WireframeData & { mode?: AiMode; version?: number };

const WireframeBox = ({ id, flat, depth = 0 }: { id: string; flat: Schema['flat']; depth?: number }) => {
  const el = flat[id];
  if (!(el as Element | undefined)) {
    return null;
  }

  const children = (el.definition.items ?? []).filter(cid => cid !== id && (flat[cid] as Element | undefined));
  const isLeaf = children.length === 0;
  const { type, label, styleSelectors } = el.definition;
  const attrContent = typeof el.attributes.content === 'string' ? el.attributes.content : null;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const displayText = attrContent ?? PLACEHOLDER[type] ?? `— ${type} —`;

  return (
    <div
      className={styleSelectors.base}
      style={{
        position: 'relative',
        outline: '1px dashed #94a3b8',
        outlineOffset: -1,
        backgroundColor: depth % 2 === 0 ? 'rgba(248,250,252,0.85)' : 'rgba(241,245,249,0.85)',
        backgroundImage: 'none',
        color: '#64748b',
        fontFamily: 'ui-monospace, monospace',
        boxShadow: 'none',
        borderRadius: 0,
        border: 'none',
        minHeight: 28
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: '0 auto auto 0',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          background: 'rgba(203,213,225,0.96)',
          padding: '0 5px',
          fontSize: 9,
          fontFamily: 'ui-monospace, monospace',
          color: '#334155',
          lineHeight: '14px',
          zIndex: 1,
          whiteSpace: 'nowrap',
          pointerEvents: 'none'
        }}
      >
        {type} · {label}
      </span>

      {isLeaf && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 28,
            paddingTop: 16,
            paddingLeft: 6,
            paddingRight: 6,
            fontSize: type === 'heading' ? 14 : 11,
            fontWeight: type === 'heading' ? 600 : 400,
            color: '#64748b',
            fontFamily: 'ui-monospace, monospace',
            textAlign: 'center',
            lineHeight: 1.3
          }}
        >
          {displayText}
        </div>
      )}
      {!isLeaf && children.map(cid => <WireframeBox key={cid} id={cid} flat={flat} depth={depth + 1} />)}
    </div>
  );
};

const WireframeCanvas = ({
  baseElementId,
  schema,
  style
}: Pick<WireframeData, 'baseElementId' | 'schema' | 'style'>) => {
  const flat = schema?.flat ?? {};
  const cssCache = style?.cache ?? '';

  return (
    <div
      className="relative h-full w-full overflow-auto"
      style={{ background: '#fff', fontFamily: 'ui-monospace, monospace' }}
    >
      {cssCache && <style dangerouslySetInnerHTML={{ __html: cssCache }} />}
      <WireframeBox id={baseElementId} flat={flat} />
    </div>
  );
};

const AIWireframePreview = ({
  baseElementId,
  name,
  description,
  schema,
  style,
  html,
  mode,
  version
}: AIWireframePreviewProps) => {
  const { theme } = use(ThemeContext);
  const { existsPopup, addPopup } = usePopup();
  const { onSendMessage, elementSelected } = useAiChatContext();
  const [showHtml, setShowHtml] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [target, setTarget] = useState<'page' | 'element'>('page');

  const handleToggleHtml = useCallback(() => setShowHtml(prev => !prev), []);
  const handleStartConfirm = useCallback(() => setConfirming(true), []);
  const handleCancel = useCallback(() => setConfirming(false), []);
  const handleTargetPage = useCallback(() => setTarget('page'), []);
  const handleTargetElement = useCallback(() => setTarget('element'), []);

  const handleClickExpand = useCallback(() => {
    if (!existsPopup('wireframe-preview')) {
      addPopup('wireframe-preview', <WireframeCanvas baseElementId={baseElementId} schema={schema} style={style} />, {
        icon: <i className="fa-solid fa-pen-ruler text-base" />,
        title: name,
        height: 480,
        width: 640,
        allowLeftSide: false,
        allowRightSide: false,
        placement: 'floating',
        resizeHandles: ['se']
      });
    }
  }, [addPopup, baseElementId, existsPopup, name, schema, style]);

  const handleConfirm = useCallback(() => {
    const where =
      target === 'element' && elementSelected
        ? `as children of the currently selected element (ID: "${elementSelected}")`
        : 'on the current page';
    onSendMessage(
      `The wireframe "${name}" has been approved. Please build this layout ${where} using the sketch_wireframe result and the appropriate tools (preview_concept or createElement).`
    );
    setConfirming(false);
  }, [name, target, elementSelected, onSendMessage]);

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-zinc-200 text-xs dark:border-zinc-700/60">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-1 font-mono text-zinc-600 dark:border-zinc-700/60 dark:bg-zinc-900 dark:text-zinc-400">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 rounded border border-zinc-300 px-1 text-[9px] tracking-wider uppercase dark:border-zinc-600">
            wireframe
          </span>
          {version && (
            <span className="shrink-0 rounded bg-zinc-200 px-1 font-mono text-[9px] text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
              v{version}
            </span>
          )}
          <span className="truncate font-medium">{name}</span>
          {description && (
            <span className="hidden truncate text-zinc-400 sm:block dark:text-zinc-600">{description}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mode === 'plan' && <span className="font-mono text-[9px] text-sky-500 dark:text-sky-600">plan</span>}
          {html && (
            <button
              onClick={handleToggleHtml}
              title={showHtml ? 'Show Wireframe' : 'Show HTML'}
              className="cursor-pointer rounded px-1 py-0.5 text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
            >
              <i className={showHtml ? 'fa-solid fa-pen-ruler' : 'fa-solid fa-code'} />
            </button>
          )}
          <button
            onClick={handleClickExpand}
            className="cursor-pointer text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
          >
            <i className="fa-solid fa-up-right-and-down-left-from-center" />
          </button>
        </div>
      </div>

      <div className="min-h-32 overflow-hidden bg-white dark:bg-zinc-950">
        {showHtml && html && (
          <CodeMirror
            value={html}
            theme={theme === 'dark' ? 'dark' : 'light'}
            size="xs"
            className="max-h-72 overflow-auto"
            readOnly
          />
        )}
        {(!showHtml || !html) && <WireframeCanvas baseElementId={baseElementId} schema={schema} style={style} />}
      </div>

      {confirming && (
        <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-700/60 dark:bg-zinc-900/60">
          <p className="mb-1.5 font-mono text-[10px] text-zinc-600 dark:text-zinc-300">
            Build <span className="font-semibold">"{name}"</span> on:
          </p>
          <div className="mb-2 flex gap-1">
            <button
              onClick={handleTargetPage}
              className={clsx('rounded border px-2 py-0.5 font-mono text-[10px]', {
                'border-zinc-400 bg-zinc-200 text-zinc-700 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-200':
                  target === 'page',
                'border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400':
                  target !== 'page'
              })}
            >
              Current Page
            </button>
            {elementSelected && (
              <button
                onClick={handleTargetElement}
                className={clsx('rounded border px-2 py-0.5 font-mono text-[10px]', {
                  'border-zinc-400 bg-zinc-200 text-zinc-700 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-200':
                    target === 'element',
                  'border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400':
                    target !== 'element'
                })}
              >
                Selected Element
              </button>
            )}
          </div>
          {target === 'element' && elementSelected && (
            <p className="mb-1.5 font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
              Will be added as children of <span className="text-orange-500">"{elementSelected}"</span>
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              className="rounded border border-zinc-200 px-2.5 py-1 font-mono text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="rounded bg-zinc-800 px-2.5 py-1 font-mono text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              Confirm & Build
            </button>
          </div>
        </div>
      )}

      {!confirming && (
        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50 px-3 py-1 dark:border-zinc-700/60 dark:bg-zinc-900/60">
          <button
            onClick={handleStartConfirm}
            className="rounded border border-zinc-300 px-2.5 py-1 font-mono text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Apply to Page
          </button>
          <button
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded border border-zinc-200 px-2.5 py-1 font-mono text-zinc-400 dark:border-zinc-700 dark:text-zinc-600"
          >
            Save as Template
          </button>
        </div>
      )}
    </div>
  );
};

export default AIWireframePreview;
