import clsx from 'clsx';

import { ACCESS_LEVELS } from '../../types';

import type { SitemapPage } from '../../types';
import type { ElementFlagGate } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type SitemapChipProps = {
  icon: string;
  /** Colours of its own; a neutral chip without. */
  className?: string;
  title?: string;
  children: ReactNode;
};

/** One fact about a page, small enough that four of them fit under its name. */
const SitemapChip = ({ icon, className, title, children }: SitemapChipProps) => (
  <span
    className={clsx(
      'flex max-w-full min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
      className ?? 'border-gray-200 bg-gray-50 text-gray-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
    )}
    title={title}
  >
    <i className={clsx(icon, 'shrink-0 text-[9px]')} />
    <span className="truncate">{children}</span>
  </span>
);

/** Who may open the page — and, when it sends everybody else elsewhere, where. */
export const SitemapAccessChip = ({ page }: { page: SitemapPage }) => {
  const access = ACCESS_LEVELS[page.access];
  const title = page.redirectTo ? `Anybody else is sent to ${page.redirectTo}` : undefined;
  const label = page.redirectTo ? `${access.label} ↪` : access.label;

  return (
    <SitemapChip icon={access.icon} className={access.badge} title={title}>
      {label}
    </SitemapChip>
  );
};

/** The feature flag the page exists under: `name` while it is on, `!name` while it is off. */
export const SitemapFlagChip = ({ gate }: { gate: ElementFlagGate }) => {
  const state = gate.is ? 'on' : 'off';
  const label = gate.is ? gate.name : `!${gate.name}`;

  return (
    <SitemapChip icon="fa-solid fa-flag" title={`Only while the feature flag ${gate.name} is ${state}`}>
      {label}
    </SitemapChip>
  );
};

export default SitemapChip;
