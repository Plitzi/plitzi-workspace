import type { IssuesLevel } from '@pmodules/Space/helpers/spaceIssues';

export const LEVEL_TEXT: Record<IssuesLevel, string> = {
  clean: 'text-zinc-500 dark:text-zinc-400',
  warnings: 'text-yellow-600 dark:text-yellow-400',
  errors: 'text-red-600 dark:text-red-400'
};

export const LEVEL_ICON: Record<IssuesLevel, string> = {
  clean: 'fa-circle-check',
  warnings: 'fa-triangle-exclamation',
  errors: 'fa-circle-xmark'
};

export const LEVEL_TITLE: Record<IssuesLevel, string> = {
  clean: 'Nothing wrong with the saved space',
  warnings: 'Things that render, but most likely not as meant',
  errors: 'Problems that stop this space from publishing'
};
