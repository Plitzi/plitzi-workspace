import { useCallback, useState } from 'react';

import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

import type { ColorItem, ColorPaletteData } from '../../helpers/getColorPaletteResult';
import type { AiMode } from '@pmodules/AI/types';

const ROLE_ORDER = [
  'primary',
  'secondary',
  'accent',
  'background',
  'surface',
  'neutral',
  'text',
  'success',
  'warning',
  'error',
  'info'
];

const sortedColors = (colors: ColorItem[]) =>
  [...colors].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a.role ?? '');
    const bi = ROLE_ORDER.indexOf(b.role ?? '');
    if (ai === -1 && bi === -1) {
      return 0;
    }
    if (ai === -1) {
      return 1;
    }
    if (bi === -1) {
      return -1;
    }
    return ai - bi;
  });

const toVarName = (role: string | undefined, name: string) =>
  `--color-${(role ?? name).toLowerCase().replace(/\s+/g, '-')}`;

const AIColorPalettePreview = ({ name, description, colors, mode }: ColorPaletteData & { mode?: AiMode }) => {
  const [confirming, setConfirming] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { onSendMessage } = useAiChatContext();

  const sorted = sortedColors(colors);
  const hasDark = sorted.some(c => c.darkHex);
  const getHex = (c: ColorItem) => (isDark && c.darkHex ? c.darkHex : c.hex);

  const copy = useCallback((hex: string) => {
    void navigator.clipboard.writeText(hex);
    setCopied(hex);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const handleConfirm = () => {
    const varList = sorted.map(c => `• ${c.role ?? c.name}: ${getHex(c)}`).join('\n');
    onSendMessage(
      `Apply the "${name}" color palette to this space. Create a style variable for each color using createStyleVariable:\n${varList}`
    );
    setConfirming(false);
  };

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-zinc-200 text-xs dark:border-zinc-700/60">
      {/* Header */}
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
                onClick={() => setIsDark(false)}
                className={`px-1.5 py-0.5 ${!isDark ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-600'}`}
                title="Light mode"
              >
                ☀
              </button>
              <button
                onClick={() => setIsDark(true)}
                className={`px-1.5 py-0.5 ${isDark ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-600'}`}
                title="Dark mode"
              >
                ☾
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Color list */}
      <div className="divide-y divide-zinc-50 bg-white dark:divide-zinc-800/60 dark:bg-zinc-950">
        {sorted.map(c => {
          const hex = getHex(c);
          const isCopied = copied === hex;
          return (
            <div key={c.name} className="flex items-center gap-2 px-3 py-1">
              <button
                onClick={() => copy(hex)}
                className="h-4 w-4 shrink-0 cursor-pointer rounded-full border border-black/10 transition-transform hover:scale-110 dark:border-white/10"
                style={{ backgroundColor: hex }}
                title={`Copy ${hex}`}
              />
              <span className="flex-1 font-medium text-zinc-700 dark:text-zinc-300">{c.name}</span>
              {c.role && <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-600">{c.role}</span>}
              <button
                onClick={() => copy(hex)}
                className="font-mono text-[10px] text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
              >
                {hex.toUpperCase()}
              </button>
              <button
                onClick={() => copy(hex)}
                className="w-3 shrink-0 text-center text-zinc-300 hover:text-zinc-500 dark:text-zinc-700 dark:hover:text-zinc-500"
              >
                {isCopied ? (
                  <i className="fa-solid fa-check text-[10px] text-emerald-500" />
                ) : (
                  <i className="fa-regular fa-copy text-[10px]" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Strip preview */}
      <div className="flex h-2" aria-hidden>
        {sorted.map(c => (
          <button
            key={c.name}
            className="flex-1 cursor-pointer"
            style={{ backgroundColor: getHex(c) }}
            onClick={() => copy(getHex(c))}
            title={`Copy ${getHex(c)}`}
          />
        ))}
      </div>

      {/* Confirmation panel */}
      {confirming && (
        <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-700/60 dark:bg-zinc-900/60">
          <p className="mb-2 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
            Create {sorted.length} style variable{sorted.length !== 1 ? 's' : ''}:
          </p>
          <div className="mb-2 max-h-28 space-y-0.5 overflow-y-auto">
            {sorted.map(c => {
              const hex = getHex(c);
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
              onClick={() => setConfirming(false)}
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
            onClick={() => setConfirming(true)}
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
