import type { ReactNode } from 'react';

export type SectionHeadingProps = {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
};

const SectionHeading = ({ eyebrow, title, subtitle }: SectionHeadingProps) => (
  <div className="mx-auto max-w-2xl text-center">
    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">{eyebrow}</span>
    <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
    {subtitle && <p className="mt-4 text-base leading-relaxed text-zinc-400">{subtitle}</p>}
  </div>
);

export default SectionHeading;
