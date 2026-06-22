import AstroGuide from './AstroGuide';
import CoreGuide from './CoreGuide';
import NextGuide from './NextGuide';
import ReactGuide from './ReactGuide';
import SvelteGuide from './SvelteGuide';
import VueGuide from './VueGuide';

import type { ComponentType } from 'react';

export type FrameworkId = 'core' | 'react' | 'vue' | 'next' | 'astro' | 'svelte';

export const FRAMEWORK_TABS: { id: FrameworkId; label: string }[] = [
  { id: 'core', label: 'Core' },
  { id: 'react', label: 'React' },
  { id: 'vue', label: 'Vue' },
  { id: 'next', label: 'Next.js' },
  { id: 'astro', label: 'Astro' },
  { id: 'svelte', label: 'Svelte' }
];

export const FRAMEWORK_GUIDES: Record<FrameworkId, ComponentType> = {
  core: CoreGuide,
  react: ReactGuide,
  vue: VueGuide,
  next: NextGuide,
  astro: AstroGuide,
  svelte: SvelteGuide
};
