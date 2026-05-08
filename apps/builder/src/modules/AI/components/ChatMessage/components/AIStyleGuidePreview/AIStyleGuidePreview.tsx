/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

import { buildCssVars, needsWhiteText, sortedShades } from './helpers';

import type { ColorScale, NamedToken, StyleGuideData } from '../../helpers/getStyleGuideResult';
import type { AiMode } from '@pmodules/AI/types';

export type AIStyleGuidePreviewProps = StyleGuideData & { mode?: AiMode };

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-1.5 font-mono text-[10px] tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
    {children}
  </div>
);

const ColorScaleRow = ({
  label,
  scale,
  onCopy,
  copied
}: {
  label: string;
  scale: ColorScale;
  onCopy: (hex: string) => void;
  copied: string | null;
}) => {
  const shades = sortedShades(scale);

  return (
    <div className="mb-2">
      <div className="mb-0.5 font-mono text-[10px] text-zinc-500 capitalize">{label}</div>
      <div className="flex gap-px overflow-hidden rounded">
        {shades.map(([shade, hex]) => {
          const white = needsWhiteText(hex);
          const isCopied = copied === hex;

          return (
            <button
              key={shade}
              onClick={() => onCopy(hex)}
              className="group relative flex-1 cursor-pointer"
              style={{ backgroundColor: hex, height: 24 }}
              title={`${label}-${shade}: ${hex}`}
            >
              <div
                className="absolute inset-0 flex flex-col items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: white ? '#fff' : '#000' }}
              >
                <span className="text-[8px]">{isCopied ? '✓' : shade}</span>
              </div>
            </button>
          );
        })}
      </div>
      {shades.length > 0 && (
        <div className="mt-0.5 font-mono text-[9px] text-zinc-400 dark:text-zinc-600">
          500 → {shades.find(([s]) => s === '500')?.[1] ?? shades[Math.floor(shades.length / 2)]?.[1] ?? ''}
        </div>
      )}
    </div>
  );
};

const SemanticDots = ({ semantic }: { semantic: NonNullable<StyleGuideData['colors']['semantic']> }) => {
  const items = [
    { label: 'Success', color: semantic.success, icon: '✓' },
    { label: 'Warning', color: semantic.warning, icon: '!' },
    { label: 'Error', color: semantic.error, icon: '✕' },
    { label: 'Info', color: semantic.info, icon: 'i' }
  ].filter(i => i.color);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap gap-2.5">
      {items.map(({ label, color, icon }) => (
        <div key={label} className="flex items-center gap-1">
          <div
            className="flex h-5 w-5 items-center justify-center rounded-full font-bold"
            style={{ backgroundColor: color, color: needsWhiteText(color) ? '#fff' : '#111', fontSize: 9 }}
          >
            {icon}
          </div>
          <div>
            <div className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300">{label}</div>
            <div className="font-mono text-[9px] text-zinc-400 dark:text-zinc-600">{color?.toUpperCase()}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const TypographyPreview = ({ typography }: { typography: NonNullable<StyleGuideData['typography']> }) => (
  <div className="mb-3">
    <SectionLabel>Typography</SectionLabel>
    <div className="rounded border border-zinc-100 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-1.5 flex gap-3 text-zinc-600 dark:text-zinc-400">
        <span>
          <strong className="text-zinc-800 dark:text-zinc-200">Heading</strong> — {typography.fontFamily.heading}
        </span>
        <span>
          <strong className="text-zinc-800 dark:text-zinc-200">Body</strong> — {typography.fontFamily.body}
        </span>
      </div>
      {typography.scale && (
        <div className="space-y-0.5 border-t border-zinc-100 pt-1.5 dark:border-zinc-800">
          {typography.scale.map(step => (
            <div key={step.name} className="flex items-baseline gap-2">
              <span className="w-7 shrink-0 font-mono text-[9px] text-zinc-400">{step.name}</span>
              <span
                className="overflow-hidden text-ellipsis whitespace-nowrap text-zinc-800 dark:text-zinc-200"
                style={{ fontSize: step.size, lineHeight: step.lineHeight, fontWeight: step.weight ?? undefined }}
              >
                Aa — {step.size}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

const TokenRow = ({ tokens, label }: { tokens: NamedToken[]; label: string }) => (
  <div className="mb-2 flex flex-wrap gap-1.5">
    {tokens.map(({ name, value }) => (
      <div key={name} className="flex flex-col items-center gap-0.5">
        <div
          className="flex h-6 items-end justify-center bg-zinc-100 dark:bg-zinc-800"
          style={{ width: 28 }}
          title={`${label}-${name}: ${value}`}
        >
          <div
            className="w-full bg-zinc-400 dark:bg-zinc-500"
            style={{ height: Math.min(24, Math.max(3, parseInt(value) || 6)) }}
          />
        </div>
        <span className="font-mono text-[9px] text-zinc-500">{name}</span>
        <span className="font-mono text-[8px] text-zinc-400">{value}</span>
      </div>
    ))}
  </div>
);

const RadiusRow = ({ tokens }: { tokens: NamedToken[] }) => (
  <div className="mb-2 flex flex-wrap gap-2.5">
    {tokens.map(({ name, value }) => (
      <div key={name} className="flex flex-col items-center gap-0.5">
        <div
          className="h-6 w-6 border-2 border-zinc-400 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/40"
          style={{ borderRadius: value }}
        />
        <span className="font-mono text-[9px] text-zinc-500">{name}</span>
        <span className="font-mono text-[8px] text-zinc-400">{value}</span>
      </div>
    ))}
  </div>
);

const ShadowRow = ({ tokens }: { tokens: NamedToken[] }) => (
  <div className="mb-2 flex flex-wrap gap-3">
    {tokens.map(({ name, value }) => (
      <div key={name} className="flex flex-col items-center gap-0.5">
        <div className="h-6 w-8 rounded bg-white dark:bg-zinc-900" style={{ boxShadow: value }} />
        <span className="font-mono text-[9px] text-zinc-500">{name}</span>
      </div>
    ))}
  </div>
);

const AIStyleGuidePreview = ({
  name,
  description,
  colors,
  colorsDark,
  typography,
  spacing,
  borderRadius,
  shadows,
  mode
}: AIStyleGuidePreviewProps) => {
  const [open, setOpen] = useState<Record<string, boolean>>({ colors: true, typography: false, tokens: false });
  const [confirming, setConfirming] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { onSendMessage } = useAiChatContext();

  const handleToggleSection = useCallback(
    (key: string) => setOpen(prev => ({ ...prev, [key]: !prev[key] })),
    []
  );

  const handleCopy = useCallback((hex: string) => {
    void navigator.clipboard.writeText(hex);
    setCopied(hex);
    setTimeout(() => setCopied(null), 1500);
  }, []);

  const handleLightMode = useCallback(() => setIsDark(false), []);
  const handleDarkMode = useCallback(() => setIsDark(true), []);
  const handleStartConfirm = useCallback(() => setConfirming(true), []);
  const handleCancel = useCallback(() => setConfirming(false), []);

  const activeColors =
    isDark && colorsDark
      ? { ...colors, ...Object.fromEntries(Object.entries(colorsDark).filter(([, v]) => v)) }
      : colors;

  const hasDark = !!colorsDark;
  const colorScaleRoles = ['primary', 'secondary', 'accent', 'neutral'] as const;
  const colorScales = colorScaleRoles
    .map(role => [role, activeColors[role]] as [string, ColorScale | undefined])
    .filter((e): e is [string, ColorScale] => !!e[1]);

  const hasTokens = spacing || borderRadius || shadows;
  const cssVars = buildCssVars(colors, typography, spacing, borderRadius, shadows);

  const handleConfirm = useCallback(() => {
    const scaleLines = colorScales
      .flatMap(([role, scale]) => sortedShades(scale).map(([shade, hex]) => `• ${role}-${shade}: ${hex}`))
      .join('\n');
    const parts = [`Color scales:\n${scaleLines}`];

    if (typography) {
      parts.push(
        `Typography:\n• heading font: ${typography.fontFamily.heading}\n• body font: ${typography.fontFamily.body}`
      );
    }

    if (spacing) {
      parts.push(`Spacing:\n${spacing.map(t => `• ${t.name}: ${t.value}`).join('\n')}`);
    }

    if (borderRadius) {
      parts.push(`Border radius:\n${borderRadius.map(t => `• ${t.name}: ${t.value}`).join('\n')}`);
    }

    onSendMessage(
      `Apply the "${name}" style guide to this space. Create CSS style variables using createStyleVariable for each design token:\n\n${parts.join('\n\n')}`
    );
    setConfirming(false);
  }, [colorScales, typography, spacing, borderRadius, name, onSendMessage]);

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-zinc-200 text-xs dark:border-zinc-700/60">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-1 font-mono text-zinc-600 dark:border-zinc-700/60 dark:bg-zinc-900 dark:text-zinc-400">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 rounded border border-zinc-300 px-1 text-[9px] tracking-wider uppercase dark:border-zinc-600">
            style guide
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
              >
                ☀
              </button>
              <button
                onClick={handleDarkMode}
                className={clsx('px-1.5 py-0.5', {
                  'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300': isDark,
                  'text-zinc-400 hover:text-zinc-600 dark:text-zinc-600': !isDark
                })}
              >
                ☾
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-zinc-50 dark:bg-zinc-950">
        <div className="border-b border-zinc-100 dark:border-zinc-800">
          <button
            onClick={() => handleToggleSection('colors')}
            className="flex w-full items-center justify-between px-3 py-1.5 text-left font-mono text-[10px] tracking-widest text-zinc-500 uppercase hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-900"
          >
            Colors
            <i className={`fa-solid fa-chevron-${open.colors ? 'up' : 'down'} text-[8px]`} />
          </button>
          {open.colors && (
            <div className="px-3 pt-1 pb-2">
              {colorScales.map(([label, scale]) => (
                <ColorScaleRow key={label} label={label} scale={scale} onCopy={handleCopy} copied={copied} />
              ))}
              {colors.semantic && <SemanticDots semantic={colors.semantic} />}
            </div>
          )}
        </div>

        {typography && (
          <div className="border-b border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => handleToggleSection('typography')}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left font-mono text-[10px] tracking-widest text-zinc-500 uppercase hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-900"
            >
              Typography
              <i className={`fa-solid fa-chevron-${open.typography ? 'up' : 'down'} text-[8px]`} />
            </button>
            {open.typography && (
              <div className="px-3 pt-1 pb-1">
                <TypographyPreview typography={typography} />
              </div>
            )}
          </div>
        )}

        {hasTokens && (
          <div>
            <button
              onClick={() => handleToggleSection('tokens')}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left font-mono text-[10px] tracking-widest text-zinc-500 uppercase hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-900"
            >
              Spacing · Radius · Shadows
              <i className={`fa-solid fa-chevron-${open.tokens ? 'up' : 'down'} text-[8px]`} />
            </button>
            {open.tokens && (
              <div className="px-3 pt-1 pb-2">
                {spacing && (
                  <>
                    <SectionLabel>Spacing</SectionLabel>
                    <TokenRow tokens={spacing} label="spacing" />
                  </>
                )}
                {borderRadius && (
                  <>
                    <SectionLabel>Border Radius</SectionLabel>
                    <RadiusRow tokens={borderRadius} />
                  </>
                )}
                {shadows && (
                  <>
                    <SectionLabel>Shadows</SectionLabel>
                    <ShadowRow tokens={shadows} />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {confirming && (
        <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-700/60 dark:bg-zinc-900/60">
          <p className="mb-2 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
            Create {cssVars.length} style variable{cssVars.length !== 1 ? 's' : ''}:
          </p>
          <div className="mb-2 max-h-36 space-y-0.5 overflow-y-auto">
            {cssVars.map(({ varName, value, preview }) => (
              <div key={varName} className="flex items-center gap-2">
                {preview && (
                  <div
                    className="h-3 w-3 shrink-0 rounded-sm border border-black/10"
                    style={{ backgroundColor: preview }}
                  />
                )}
                {!preview && <span className="h-3 w-3 shrink-0" />}
                <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-300">{varName}</span>
                <span className="ml-auto truncate font-mono text-[10px] text-zinc-400 dark:text-zinc-600">{value}</span>
              </div>
            ))}
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
        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50 px-3 py-1 dark:border-zinc-700/60 dark:bg-zinc-900/60">
          <button
            onClick={handleStartConfirm}
            className="rounded border border-zinc-300 px-2.5 py-1 font-mono text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Apply to Space
          </button>
          <button
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded border border-zinc-200 px-2.5 py-1 font-mono text-zinc-400 dark:border-zinc-700 dark:text-zinc-600"
          >
            Export CSS Variables
          </button>
        </div>
      )}
    </div>
  );
};

export default AIStyleGuidePreview;
