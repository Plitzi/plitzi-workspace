import arrayMap from './arrayMap';
import capitalize from './capitalize';
import dateConverter from './dateConverter';
import staticValue from './staticValue';
import styleSelector from './styleSelector';
import twigTemplate from './twigTemplate';

import type { DataSourceUtility } from '@plitzi/sdk-shared';

const utilities = {
  twigTemplate,
  dateConverter,
  staticValue,
  capitalize,
  arrayMap,
  styleSelector
} as Record<string, DataSourceUtility>;

export const utilityOptions = Object.values(utilities).map(({ title, action }) => ({ label: title, value: action }));

export default utilities;
