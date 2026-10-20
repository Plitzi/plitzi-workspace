import type { Style, StyleTarget } from '@plitzi/sdk-shared';

export const createBaseStyle = (): Pick<Style, 'platform' | 'variables'> => ({
  platform: { desktop: {}, tablet: {}, mobile: {} },
  variables: {}
});

export const paramsBase: StyleTarget & { styleSelector: string } = {
  componentType: undefined,
  styleSelector: 'base'
};
