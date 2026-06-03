/* eslint-disable @typescript-eslint/no-explicit-any */

import arrayMap from './arrayMap';
import capitalize from './capitalize';
import dateConverter from './dateConverter';
import staticValue from './staticValue';
import stringToArray from './stringToArray';
import styleSelector from './styleSelector';
import twigTemplate from './twigTemplate';

import type { DataSourceUtility } from '@plitzi/sdk-shared';

const utilities = {
  twigTemplate,
  dateConverter,
  staticValue,
  capitalize,
  arrayMap,
  stringToArray,
  styleSelector
} as Record<string, DataSourceUtility<any, any, any>>;

export const utilityOptions = Object.values(utilities).map(({ title, action }) => ({ label: title, value: action }));

export default utilities;
