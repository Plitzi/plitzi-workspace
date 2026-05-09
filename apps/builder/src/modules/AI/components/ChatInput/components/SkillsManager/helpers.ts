import type { AiSkill, AiSkillCategory } from '@pmodules/AI/types';

export type Category = { id: AiSkillCategory | 'all'; label: string };

export const CATEGORIES: Category[] = [
  { id: 'all', label: 'All' },
  { id: 'design', label: 'Design' },
  { id: 'content', label: 'Content' },
  { id: 'data', label: 'Data' },
  { id: 'performance', label: 'Performance' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'enterprise', label: 'Enterprise' }
];

export const SOURCE_BADGE_CLASS: Record<AiSkill['source'], string> = {
  builtin: 'border-neutral-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-600',
  team: 'border-purple-300/60 bg-purple-500/8 text-purple-500 dark:border-purple-400/40 dark:text-purple-400',
  mine: 'border-pink-300/60 bg-pink-500/8 text-pink-500 dark:border-pink-400/40 dark:text-pink-400'
};
