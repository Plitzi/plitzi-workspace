/**
 * Why a lead approved a task without its designer's UI review, said as it does (`--skip-design <why>`): it looked at the
 * UI itself (`lead`), or the task changes nothing a visitor sees (`no-ui`). Never "skipped" alone: read as nobody
 * looking at it, where the lead had (21 tasks reviewed by the lead, counted as "UI skipped").
 */
export const DESIGN_SKIPS = ['lead', 'no-ui'] as const;

export type DesignSkip = (typeof DESIGN_SKIPS)[number];

export const isDesignSkip = (value: unknown): value is DesignSkip =>
  typeof value === 'string' && (DESIGN_SKIPS as readonly string[]).includes(value);

/** Why a lead approved without the designer's UI review, as every surface says it — never "skipped" alone. */
export const designSkipText = (why: DesignSkip | undefined): string =>
  why === 'lead'
    ? 'its UI reviewed by the lead, not a designer (--skip-design lead)'
    : why === 'no-ui'
      ? 'no UI to review: it changes nothing a visitor sees (--skip-design no-ui)'
      : 'approved without its designer’s UI review, the reason unsaid';
