import { useCallback, useState } from 'react';

import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

import type { AiMode } from '@pmodules/AI/types';
import type { BrandData } from '../../helpers/getBrandResult';

const needsWhiteText = (hex: string): boolean => {
  if (hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
};

const COLOR_LABELS: Record<string, string> = {
  primary: 'Primary', secondary: 'Secondary', accent: 'Accent',
  background: 'Background', surface: 'Surface', text: 'Text'
};

const AIBrandPreview = ({ name, tagline, personality, colors, colorsDark, typography, voice, mode }: BrandData & { mode?: AiMode }) => {
  const [confirming, setConfirming] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { onSendMessage } = useAiChatContext();

  const activeColors = (isDark && colorsDark)
    ? { ...colors, ...Object.fromEntries(Object.entries(colorsDark).filter(([, v]) => v)) }
    : colors;

  const colorEntries = Object.entries(activeColors).filter(([, hex]) => hex) as [string, string][];
  const bg = activeColors.background ?? (isDark ? '#0f172a' : '#ffffff');
  const fg = activeColors.text ?? (isDark ? '#f1f5f9' : '#0f172a');
  const hasDark = !!colorsDark;

  const copy = useCallback((hex: string) => {
    void navigator.clipboard.writeText(hex);
    setCopied(hex);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const cssVars = [
    ...colorEntries.map(([role, hex]) => ({ varName: `--brand-${role}`, value: hex, preview: hex })),
    ...(typography ? [
      { varName: '--brand-font-heading', value: typography.heading.family, preview: undefined },
      { varName: '--brand-font-body', value: typography.body.family, preview: undefined }
    ] : [])
  ];

  const handleConfirm = () => {
    const colorLines = colorEntries.map(([role, hex]) => `• brand-${role}: ${hex}`).join('\n');
    const fontLines = typography
      ? `\n• font-heading: ${typography.heading.family}\n• font-body: ${typography.body.family}`
      : '';
    onSendMessage(
      `Apply the "${name}" brand identity to this space. Create style variables using createStyleVariable:\n${colorLines}${fontLines}`
    );
    setConfirming(false);
  };

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-purple-200 text-xs dark:border-purple-900/50">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-purple-100 bg-purple-50 px-3 py-1 font-mono text-purple-600 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-400">
        <div className="flex items-center gap-1.5">
          <span className="rounded border border-purple-300 px-1 text-[9px] uppercase tracking-wider dark:border-purple-700">brand</span>
          <span className="font-medium">{name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {mode === 'plan' && <span className="text-[9px] text-purple-400 dark:text-purple-600">plan</span>}
          {hasDark && (
            <div className="flex overflow-hidden rounded border border-purple-200 dark:border-purple-800">
              <button
                onClick={() => setIsDark(false)}
                className={`px-1.5 py-0.5 ${!isDark ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-600'}`}
              >☀</button>
              <button
                onClick={() => setIsDark(true)}
                className={`px-1.5 py-0.5 ${isDark ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-600'}`}
              >☾</button>
            </div>
          )}
        </div>
      </div>

      {/* Brand showcase */}
      <div className="bg-white dark:bg-zinc-950">
        {/* Hero strip — compact */}
        <div
          className="px-4 py-3"
          style={{ backgroundColor: activeColors.primary, color: needsWhiteText(activeColors.primary) ? '#fff' : '#111' }}
        >
          <div
            className="text-base font-bold leading-tight tracking-tight"
            style={{ fontFamily: typography?.heading.family, letterSpacing: typography?.heading.tracking ?? undefined }}
          >
            {name}
          </div>
          {tagline && (
            <div className="mt-0.5 text-[11px] opacity-80" style={{ fontFamily: typography?.body.family }}>
              {tagline}
            </div>
          )}
        </div>

        {/* Colors */}
        <div className="px-3 pt-3">
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Colors</div>
          <div className="flex flex-wrap gap-2">
            {colorEntries.map(([role, hex]) => (
              <button
                key={role}
                onClick={() => copy(hex)}
                className="flex flex-col items-center gap-0.5 cursor-pointer"
                title={`Copy ${hex}`}
              >
                <div
                  className="h-8 w-8 rounded-full border border-black/10 shadow-sm dark:border-white/10"
                  style={{ backgroundColor: hex }}
                />
                <span className="font-mono text-[9px] text-zinc-500">{COLOR_LABELS[role] ?? role}</span>
                {copied === hex
                  ? <i className="fa-solid fa-check text-[9px] text-emerald-500" />
                  : <span className="font-mono text-[8px] text-zinc-400">{hex.toUpperCase()}</span>
                }
              </button>
            ))}
          </div>
        </div>

        {/* Personality */}
        {personality.length > 0 && (
          <div className="px-3 pt-2.5">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Personality</div>
            <div className="flex flex-wrap gap-1">
              {personality.map(trait => (
                <span
                  key={trait}
                  className="rounded-full px-2 py-0.5 font-medium"
                  style={{
                    backgroundColor: `${activeColors.primary}18`,
                    color: activeColors.primary,
                    border: `1px solid ${activeColors.primary}40`
                  }}
                >
                  {trait}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Typography */}
        {typography && (
          <div className="px-3 pt-2.5">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Typography</div>
            <div
              className="rounded border border-zinc-100 p-2 dark:border-zinc-800"
              style={{ backgroundColor: bg, color: fg }}
            >
              <div
                className="text-sm font-bold leading-snug"
                style={{ fontFamily: typography.heading.family, letterSpacing: typography.heading.tracking ?? undefined }}
              >
                {typography.heading.family}
              </div>
              <div
                className="mt-0.5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400"
                style={{ fontFamily: typography.body.family }}
              >
                {typography.body.family} — The quick brown fox jumps over the lazy dog.
              </div>
            </div>
          </div>
        )}

        {/* Voice */}
        {voice && (
          <div className="px-3 py-2.5 pt-2.5">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Voice & Tone</div>
            <p className="italic text-zinc-600 dark:text-zinc-400">"{voice.tone}"</p>
            {voice.keywords && voice.keywords.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {voice.keywords.map(kw => (
                  <span key={kw} className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation panel */}
      {confirming && (
        <div className="border-t border-purple-100 bg-purple-50/60 px-3 py-2 dark:border-purple-900/30 dark:bg-purple-950/20">
          <p className="mb-2 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
            Create {cssVars.length} style variable{cssVars.length !== 1 ? 's' : ''}:
          </p>
          <div className="mb-2 max-h-28 space-y-0.5 overflow-y-auto">
            {cssVars.map(({ varName, value, preview }) => (
              <div key={varName} className="flex items-center gap-2">
                {preview
                  ? <div className="h-3 w-3 shrink-0 rounded-sm border border-black/10" style={{ backgroundColor: preview }} />
                  : <span className="h-3 w-3 shrink-0 text-center font-mono text-[8px] leading-3 text-zinc-400">Aa</span>
                }
                <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-300">{varName}</span>
                <span className="ml-auto truncate font-mono text-[10px] text-zinc-400 dark:text-zinc-600">{value}</span>
              </div>
            ))}
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
              className="rounded bg-purple-600 px-2.5 py-1 font-mono text-white hover:bg-purple-700"
            >
              Confirm & Apply
            </button>
          </div>
        </div>
      )}

      {!confirming && (
        <div className="flex items-center justify-end gap-2 border-t border-purple-100 bg-purple-50/50 px-3 py-1.5 dark:border-purple-900/30 dark:bg-purple-950/20">
          <button
            onClick={() => setConfirming(true)}
            className="rounded border border-purple-300 px-2.5 py-1 font-mono text-purple-600 hover:bg-purple-100 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/40"
          >
            Apply to Space
          </button>
          <button
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded border border-zinc-200 px-2.5 py-1 font-mono text-zinc-400 dark:border-zinc-700 dark:text-zinc-600"
          >
            Save Brand
          </button>
        </div>
      )}
    </div>
  );
};

export default AIBrandPreview;
