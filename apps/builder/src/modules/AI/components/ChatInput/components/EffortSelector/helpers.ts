import type { AiEffort } from '@pmodules/AI/types';

export type EffortOption = {
  id: AiEffort;
  label: string;
  desc: string;
  meta: [string, string][];
};

export const OPTIONS: EffortOption[] = [
  {
    id: 'low',
    label: 'Low',
    desc: 'Fast responses, minimal reasoning.',
    meta: [
      ['~', '< 1s'],
      ['cost', '1x']
    ]
  },
  {
    id: 'medium',
    label: 'Medium',
    desc: 'Balanced default — thinks before acting.',
    meta: [
      ['~', '~3s'],
      ['cost', '2x']
    ]
  },
  {
    id: 'high',
    label: 'High',
    desc: 'Deep reasoning for complex tasks.',
    meta: [
      ['~', '~12s'],
      ['cost', '5x']
    ]
  }
];

export const BARS_FILLED: Record<AiEffort, number> = { low: 1, medium: 2, high: 3 };
