import type { ElementFlagGate } from '@plitzi/sdk-shared';

/**
 * Who may open a page, as the page's `accessLevel` decides it: unset is anyone, `public` is only somebody signed out,
 * `authenticated` only somebody signed in.
 */
export type AccessLevel = 'everyone' | 'guests' | 'signedIn';

export type SitemapPage = {
  type: 'page';
  id: string;
  title: string;
  path: string;
  access: AccessLevel;
  isDefault: boolean;
  /** The layout it renders inside, by name. */
  layout?: string;
  /** The feature flag it exists under. */
  flag?: ElementFlagGate;
  /** Where somebody it refuses is sent, by page name. */
  redirectTo?: string;
};

export type SitemapFolder = {
  type: 'folder';
  id: string;
  title: string;
  path: string;
  children: SitemapEntry[];
};

/** A page or a folder of the site, as the sitemap draws it. */
export type SitemapEntry = SitemapPage | SitemapFolder;

/** One look per access level, for the cards and the legend alike. */
export const ACCESS_LEVELS: Record<AccessLevel, { label: string; icon: string; accent: string; badge: string }> = {
  everyone: {
    label: 'Everyone',
    icon: 'fa-solid fa-globe',
    accent: 'bg-emerald-500',
    badge:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
  },
  guests: {
    label: 'Guests only',
    icon: 'fa-solid fa-user-slash',
    accent: 'bg-amber-500',
    badge:
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
  },
  signedIn: {
    label: 'Signed in',
    icon: 'fa-solid fa-shield-halved',
    accent: 'bg-primary-500',
    badge:
      'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-400/30 dark:bg-primary-400/10 dark:text-primary-200'
  }
};
