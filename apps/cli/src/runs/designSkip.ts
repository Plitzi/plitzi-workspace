/**
 * Why a task was approved without its designer's UI review, said as its reviewer does (`--skip-design <why>`): the
 * reviewer — a tester, or the lead — looked at the UI itself (`reviewer`), or the task changes nothing a visitor sees
 * (`no-ui`). Never "skipped" alone: read as nobody
 * looking at it, where the lead had (21 tasks reviewed by the lead, counted as "UI skipped").
 */
export const DESIGN_SKIPS = ['reviewer', 'no-ui'] as const;

export type DesignSkip = (typeof DESIGN_SKIPS)[number];

export const isDesignSkip = (value: unknown): value is DesignSkip =>
  typeof value === 'string' && (DESIGN_SKIPS as readonly string[]).includes(value);

/** Why a task was approved without the designer's UI review, as every surface says it — never "skipped" alone. */
export const designSkipText = (why: DesignSkip | undefined): string =>
  why === 'reviewer'
    ? 'its UI reviewed by its reviewer, not a designer (plitzi task review --skip-design reviewer)'
    : why === 'no-ui'
      ? 'no UI to review: it changes nothing a visitor sees (plitzi task review --skip-design no-ui)'
      : 'approved without its designer’s UI review, the reason unsaid';
