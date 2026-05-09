export type ModelTag = 'fast' | 'smart' | 'vision';

export const deriveTag = (id: string): ModelTag | undefined => {
  const lower = id.toLowerCase();
  if (/haiku|flash|mini|fast/.test(lower)) {
    return 'fast';
  }

  if (/opus|max|pro|large/.test(lower)) {
    return 'smart';
  }

  if (/vision|multi/.test(lower)) {
    return 'vision';
  }

  return undefined;
};

export const TAG_CLASS: Record<ModelTag, string> = {
  fast: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500 dark:border-emerald-400/40 dark:text-emerald-400',
  smart: 'border-purple-400/40 bg-purple-500/8 text-purple-500 dark:border-purple-400/40 dark:text-purple-400',
  vision: 'border-pink-400/40 bg-pink-500/8 text-pink-500 dark:border-pink-400/40 dark:text-pink-400'
};
