import { useCallback, useState } from 'react';

import { useAiChatContext } from '@pmodules/AI/contexts/AiChatContext';

import BrandColors from './components/BrandColors';
import BrandConfirmPanel from './components/BrandConfirmPanel';
import BrandHeader from './components/BrandHeader';
import BrandHero from './components/BrandHero';
import BrandPersonality from './components/BrandPersonality';
import BrandTypography from './components/BrandTypography';
import BrandVoice from './components/BrandVoice';

import type { BrandCssVar } from './components/BrandConfirmPanel';
import type { BrandData } from '../../helpers/toolVisualTypes';
import type { AiMode } from '@pmodules/AI/types';

export type AIBrandPreviewProps = BrandData & { mode?: AiMode };

const AIBrandPreview = ({
  name,
  tagline,
  personality,
  colors,
  colorsDark,
  typography,
  voice,
  mode
}: AIBrandPreviewProps) => {
  const [confirming, setConfirming] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { onSendMessage } = useAiChatContext();

  const activeColors =
    isDark && colorsDark
      ? { ...colors, ...Object.fromEntries(Object.entries(colorsDark).filter(([, v]) => v)) }
      : colors;

  const colorEntries = Object.entries(activeColors).filter(([, hex]) => hex);
  const bg = activeColors.background ?? (isDark ? '#0f172a' : '#ffffff');
  const fg = activeColors.text ?? (isDark ? '#f1f5f9' : '#0f172a');
  const hasDark = !!colorsDark;

  const cssVars: BrandCssVar[] = [
    ...colorEntries.map(([role, hex]) => ({ varName: `--brand-${role}`, value: hex, preview: hex })),
    ...(typography
      ? [
          { varName: '--brand-font-heading', value: typography.heading.family, preview: undefined },
          { varName: '--brand-font-body', value: typography.body.family, preview: undefined }
        ]
      : [])
  ];

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
    const colorLines = colorEntries.map(([role, hex]) => `• brand-${role}: ${hex}`).join('\n');
    const fontLines = typography
      ? `\n• font-heading: ${typography.heading.family}\n• font-body: ${typography.body.family}`
      : '';

    onSendMessage(
      `Apply the "${name}" brand identity to this space. Create style variables using createStyleVariable:\n${colorLines}${fontLines}`
    );
    setConfirming(false);
  }, [colorEntries, typography, name, onSendMessage]);

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-zinc-200 text-xs dark:border-zinc-700/60">
      <BrandHeader
        name={name}
        mode={mode}
        hasDark={hasDark}
        isDark={isDark}
        onLightMode={handleLightMode}
        onDarkMode={handleDarkMode}
      />

      <div className="bg-white dark:bg-zinc-950">
        <BrandHero name={name} tagline={tagline} primaryColor={activeColors.primary} typography={typography} />
        <BrandColors colorEntries={colorEntries} copied={copied} onCopy={handleCopy} />
        {personality.length > 0 && <BrandPersonality personality={personality} primaryColor={activeColors.primary} />}
        {typography && <BrandTypography typography={typography} bg={bg} fg={fg} />}
        {voice && <BrandVoice voice={voice} />}
      </div>

      <BrandConfirmPanel
        confirming={confirming}
        cssVars={cssVars}
        onStartConfirm={handleStartConfirm}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default AIBrandPreview;
