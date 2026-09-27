export type IssueSeverity = 'error' | 'warning';

export const SEVERITY_TEXT: Record<IssueSeverity, string> = {
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-yellow-600 dark:text-yellow-400'
};

export const SEVERITY_ICON: Record<IssueSeverity, string> = {
  error: 'fa-circle-xmark',
  warning: 'fa-triangle-exclamation'
};

export const MUTED = 'text-zinc-500 dark:text-zinc-400';
