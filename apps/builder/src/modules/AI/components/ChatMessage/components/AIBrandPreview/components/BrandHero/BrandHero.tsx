import { needsWhiteText } from '../../helpers';

import type { BrandData } from '../../../../helpers/getBrandResult';

export type BrandHeroProps = {
  name: string;
  tagline?: string;
  primaryColor: string;
  typography?: BrandData['typography'];
};

const BrandHero = ({ name, tagline, primaryColor, typography }: BrandHeroProps) => (
  <div
    className="px-3 py-1"
    style={{
      backgroundColor: primaryColor,
      color: needsWhiteText(primaryColor) ? '#fff' : '#111'
    }}
  >
    <div
      className="text-sm leading-tight font-bold tracking-tight"
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
);

export default BrandHero;
