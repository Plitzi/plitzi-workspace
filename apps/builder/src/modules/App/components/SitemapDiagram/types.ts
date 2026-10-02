export type AccessLevel = 'none' | 'public' | 'authenticated';

type SitemapEntryBase = {
  id: string;
  title: string;
  accessLevel: AccessLevel;
  description?: string;
  path?: string;
};

/** A page or a folder of the site, as the sitemap draws it. */
export type SitemapEntry =
  | (SitemapEntryBase & { type: 'page'; path: string; isDefault: boolean })
  | (SitemapEntryBase & { type: 'folder'; children: SitemapEntry[] });

/** One look per access level, for the cards and the legend alike. */
export const ACCESS_LEVELS: Record<AccessLevel, { label: string; icon: string; dot: string; badge: string }> = {
  public: {
    label: 'Public',
    icon: 'fa-solid fa-globe',
    dot: 'bg-emerald-500',
    badge:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
  },
  authenticated: {
    label: 'Signed in',
    icon: 'fa-solid fa-shield-halved',
    dot: 'bg-primary-500',
    badge:
      'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-400/30 dark:bg-primary-400/10 dark:text-primary-200'
  },
  none: {
    label: 'None',
    icon: 'fa-solid fa-lock',
    dot: 'bg-slate-400',
    badge: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
  }
};
