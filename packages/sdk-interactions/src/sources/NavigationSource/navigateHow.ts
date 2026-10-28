import type { NavigateHow } from '@plitzi/sdk-shared';

/** How a `navigate` step goes: a whole address leaves the space, and either may take the place of the one it is on. */
export const navigateHow = ({ urlType, replace = false }: { urlType: string; replace?: boolean }): NavigateHow => ({
  external: urlType === 'external',
  replace
});
