import { REUSE } from '@pmodules/Builder/helpers/reuse';

import type { UsageCategory, UsageTreeKind } from './usageIndex';

/** The order the panel offers them in. */
export const USAGE_CATEGORIES: readonly UsageCategory[] = ['components', 'classes', 'variables', 'dataSources'];

export const isUsageCategory = (value: string): value is UsageCategory =>
  USAGE_CATEGORIES.some(category => category === value);

type CategoryCopy = {
  /** What the category is called in the panel's picker. */
  label: string;
  /** What the search box searches. */
  search: string;
  /** Said when the space declares none. */
  empty: string;
  /** Said of an item nothing uses, under its name. */
  unused: string;
  /** What the unused filter is called. */
  unusedFilter: string;
};

export const CATEGORY_COPY: Record<UsageCategory, CategoryCopy> = {
  components: {
    label: 'Components',
    search: 'Search components',
    empty: 'This space has no components.',
    unused: 'Placed nowhere: no page, layout or component has a reference to it.',
    unusedFilter: 'Unused only'
  },
  classes: {
    label: 'Classes',
    search: 'Search classes',
    empty: 'This space declares no classes.',
    unused: 'Nothing in the space names it: no element, binding, flow, setting or other class.',
    unusedFilter: 'Unused only'
  },
  variables: {
    label: 'Tokens and variables',
    search: 'Search tokens and variables',
    empty: 'This space declares no style tokens or variables.',
    unused:
      'Nothing in this space reads it: no `var(--…)` of it anywhere, and for a space variable no template either.',
    unusedFilter: 'Unused only'
  },
  dataSources: {
    label: 'Data sources',
    search: 'Search data sources',
    empty: 'Nothing in this space provides or reads data yet.',
    unused: 'Nothing binds to it or reads it in a template.',
    unusedFilter: 'Unread only'
  }
};

/** What "unused" can and cannot know, said once over every list. */
export const UNUSED_NOTE =
  '“Unused” means nothing in this space uses it — a plugin’s own code or stylesheet may still.';

export const TREE_ICON: Record<UsageTreeKind, string> = {
  page: 'fa-solid fa-file',
  layout: 'fa-solid fa-border-all',
  component: REUSE.component.icon
};
