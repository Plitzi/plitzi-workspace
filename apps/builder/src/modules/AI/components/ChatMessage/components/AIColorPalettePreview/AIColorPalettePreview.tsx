import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

import ColorPaletteRow from './components/ColorPaletteRow';
import ColorStripItem from './components/ColorStripItem';
import { getHex, sortedColors, toVarName } from './helpers';

import type { ColorPaletteData } from '../../helpers/toolVisualTypes';
import type { AiMode } from '@pmodules/AI/types';

export type AIColorPalettePreviewProps = ColorPaletteData & { mode?: AiMode };

const AIColorPalettePreview = ({ name, description, colors, mode }: AIColorPalettePreviewProps) => {
  const [confirming, setConfirming] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { onSendMessage } = useAiChatContext();

  const sorted = sortedColors(colors);
  const hasDark = sorted.some(c => c.darkHex);

  const handleCopy = useCallback((hex: string) => {
    void navigator.clipboard.writeText(hex);
    setCopied(hex);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const handleLightMode = useCallback(() => setIsDark(false), []);

  const handleDarkMode = useCallback(() => setIsDark(true), []);

  const handleStartConfirm = useCallback(() => setConfirming(true), []);

  const handleCancel = useCallback(() => setConfirming(false), []);

  const handleConfirm = useCallback(() => {
    const varList = sorted.map(c => `• ${c.role ?? c.name}: ${getHex(c, isDark)}`).join('\n');

    onSendMessage(
      `Apply the "${name}" color palette to this space. Create a style variable for each color using createStyleVariable:\n${varList}`
    );
    setConfirming(false);
  }, [sorted, isDark, name, onSendMessage]);

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-zinc-200 text-xs dark:border-zinc-700/60">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-1 font-mono text-zinc-600 dark:border-zinc-700/60 dark:bg-zinc-900 dark:text-zinc-400">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 rounded border border-zinc-300 px-1 text-[9px] tracking-wider uppercase dark:border-zinc-600">
            palette
          </span>
          <span className="truncate font-medium">{name}</span>
          {description && (
            <span className="hidden truncate text-zinc-400 sm:block dark:text-zinc-600">{description}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {mode === 'plan' && <span className="text-[9px] text-sky-500 dark:text-sky-600">plan</span>}
          {hasDark && (
            <div className="flex overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
              <button
                onClick={handleLightMode}
                className={clsx('px-1.5 py-0.5', {
                  'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300': !isDark,
                  'text-zinc-400 hover:text-zinc-600 dark:text-zinc-600': isDark
                })}
                title="Light mode"
              >
                ☀
              </button>
              <button
                onClick={handleDarkMode}
                className={clsx('px-1.5 py-0.5', {
                  'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300': isDark,
                  'text-zinc-400 hover:text-zinc-600 dark:text-zinc-600': !isDark
                })}
                title="Dark mode"
              >
                ☾
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-zinc-50 bg-white dark:divide-zinc-800/60 dark:bg-zinc-950">
        {sorted.map(c => (
          <ColorPaletteRow
            key={c.name}
            item={c}
            hex={getHex(c, isDark)}
            isCopied={copied === getHex(c, isDark)}
            onCopy={handleCopy}
          />
        ))}
      </div>

      <div className="flex h-2" aria-hidden>
        {sorted.map(c => (
          <ColorStripItem key={c.name} name={c.name} hex={getHex(c, isDark)} onCopy={handleCopy} />
        ))}
      </div>

      {confirming && (
        <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-700/60 dark:bg-zinc-900/60">
          <p className="mb-2 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
            Create {sorted.length} style variable{sorted.length !== 1 ? 's' : ''}:
          </p>
          <div className="mb-2 max-h-28 space-y-0.5 overflow-y-auto">
            {sorted.map(c => {
              const hex = getHex(c, isDark);

              return (
                <div key={c.name} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 shrink-0 rounded-sm border border-black/10"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-300">
                    {toVarName(c.role, c.name)}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
                    {hex.toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
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
              Confirm & Apply
            </button>
          </div>
        </div>
      )}

      {!confirming && (
        <div className="flex items-center justify-end border-t border-zinc-100 bg-zinc-50 px-3 py-1 dark:border-zinc-700/60 dark:bg-zinc-900/60">
          <button
            onClick={handleStartConfirm}
            className="rounded border border-zinc-300 px-2.5 py-1 font-mono text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Apply to Space
          </button>
        </div>
      )}
    </div>
  );
};

export default AIColorPalettePreview;
