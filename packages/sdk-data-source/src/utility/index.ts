import arrayMap from './arrayMap';
import capitalize from './capitalize';
import dateConverter from './dateConverter';
import staticValue from './staticValue';
import twigTemplate from './twigTemplate';

import type { DataSourceUtility } from '@plitzi/sdk-shared';

const utilities = { twigTemplate, dateConverter, staticValue, capitalize, arrayMap } as Record<
  string,
  DataSourceUtility
>;

export default utilities;
