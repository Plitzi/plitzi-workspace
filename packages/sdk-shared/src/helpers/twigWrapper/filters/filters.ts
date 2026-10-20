import { arrayTransformFilters } from './arrays';
import { dateFilters } from './dates';
import { encodingFilters, miscFilters, randomFilters, whitespaceFilters } from './misc';
import { numberFilters } from './numbers';
import { objectFilters, queryFilters } from './objects';
import {
  defaultFilters,
  identityFilters,
  serialisationFilters,
  stringOperationFilters,
  stringQueryFilters,
  stringTransformFilters
} from './strings';

import type { TwigFilter } from './types';

export * from './raw';
export * from './types';

export const filters: Record<string, TwigFilter> = {
  ...identityFilters,
  ...serialisationFilters,
  ...defaultFilters,
  ...stringTransformFilters,
  ...stringOperationFilters,
  ...stringQueryFilters,
  ...numberFilters,
  ...arrayTransformFilters,
  ...miscFilters,
  ...whitespaceFilters,
  ...randomFilters,
  ...dateFilters,
  ...encodingFilters,
  ...objectFilters,
  ...queryFilters
};
