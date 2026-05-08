import type { BrandData } from '../../../../helpers/getBrandResult';

export type BrandTypographyProps = {
  typography: NonNullable<BrandData['typography']>;
  bg: string;
  fg: string;
};

const BrandTypography = ({ typography, bg, fg }: BrandTypographyProps) => (
  <div className="px-3 pt-2">
    <div className="mb-1 font-mono text-[10px] tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
      Typography
    </div>
    <div className="rounded border border-zinc-100 p-2 dark:border-zinc-800" style={{ backgroundColor: bg, color: fg }}>
      <div
        className="text-sm leading-snug font-bold"
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
);

export default BrandTypography;
