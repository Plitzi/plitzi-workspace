import arrayMap from './arrayMap';
import capitalize from './capitalize';
import dateConverter from './dateConverter';
import not from './not';
import staticValue from './staticValue';
import stringToArray from './stringToArray';
import styleSelector from './styleSelector';
import styleVariant from './styleVariant';
import twigTemplate from './twigTemplate';

import type { DataSourceUtility } from '../../types';

const utilities = {
  twigTemplate,
  dateConverter,
  staticValue,
  capitalize,
  arrayMap,
  stringToArray,
  not,
  styleSelector,
  styleVariant
  // Each utility types its own params and source, and a callback taking narrower ones is not a callback taking any: a
  // registry of them is read by action name and called with what the binding resolved, which only `any` can say.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as Record<string, DataSourceUtility<any, any, any>>;

export const utilityOptions = Object.values(utilities).map(({ title, action }) => ({ label: title, value: action }));

export default utilities;
