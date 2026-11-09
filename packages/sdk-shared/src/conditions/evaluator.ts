import { isDate, toUnixSeconds } from './dates';
import { isNumeric, isRuleGroup } from './rules';
import { get, set } from '../helpers/lodash';

import type { Rule, RuleGroup, RuleValue } from './types';

type NestedBoolean = boolean | NestedBoolean[];

// Transformers

export const transformQueryJson = (raw?: RuleGroup) => {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const { combinator, enabled } = raw;
  let { rules } = raw;
  if (!Array.isArray(rules)) {
    return undefined;
  }

  rules = rules
    .map(rule => {
      if (isRuleGroup(rule)) {
        return transformQueryJson(rule);
      }

      const { field, value, operator, enabled, isBinding } = rule;

      return { field, value, operator, enabled, isBinding };
    })
    .filter(Boolean) as (Rule | RuleGroup)[];

  return { rules, combinator, enabled };
};

export const transformQuery = (raw?: RuleGroup, transformTo = 'json') => {
  switch (transformTo) {
    case 'json':
    default:
      return transformQueryJson(raw);
  }
};

// Evaluate by operator

export const evaluateEquals = (value: RuleValue, valueToCompare: RuleValue) => {
  if (typeof value === 'boolean' && typeof valueToCompare === 'string') {
    valueToCompare = valueToCompare.toLowerCase();
    valueToCompare = valueToCompare === 'true' || valueToCompare === '1';

    return value === valueToCompare;
  }

  if (typeof value === 'string' && typeof valueToCompare === 'boolean') {
    value = value.toLowerCase();
    value = value === 'true' || value === '1';

    return value === valueToCompare;
  }

  if (typeof value === 'number') {
    value = `${value}`;
  }

  if (typeof valueToCompare === 'number') {
    valueToCompare = `${valueToCompare}`;
  }

  return value === valueToCompare;
};

export const evaluateGreaterThan = (value: RuleValue, valueToCompare: RuleValue) => {
  if (value === null || value === undefined || valueToCompare === null || valueToCompare === undefined) {
    return false;
  }

  if (isDate(value) && isDate(valueToCompare)) {
    value = toUnixSeconds(value);
    valueToCompare = toUnixSeconds(valueToCompare);

    return parseFloat(valueToCompare) > parseFloat(value);
  }

  if (!isNumeric(value)) {
    return valueToCompare > value;
  }

  value = parseFloat(value as string);
  valueToCompare = parseFloat(valueToCompare as string);

  return isNumeric(valueToCompare) && valueToCompare > value;
};

export const evaluateGreaterThanOrEqual = (value: RuleValue, valueToCompare: RuleValue) =>
  evaluateGreaterThan(value, valueToCompare) || evaluateEquals(value, valueToCompare);

export const evaluateLessThan = (value: RuleValue, valueToCompare: RuleValue) => {
  if (value === null || value === undefined || valueToCompare === null || valueToCompare === undefined) {
    return false;
  }

  if (isDate(value) && isDate(valueToCompare)) {
    value = toUnixSeconds(value);
    valueToCompare = toUnixSeconds(valueToCompare);

    return parseFloat(valueToCompare) < parseFloat(value);
  }

  if (!isNumeric(value)) {
    return valueToCompare < value;
  }

  value = parseFloat(value as string);
  valueToCompare = parseFloat(valueToCompare as string);

  return isNumeric(valueToCompare) && valueToCompare < value;
};

export const evaluateLessThanOrEqual = (value: RuleValue, valueToCompare: RuleValue) =>
  evaluateLessThan(value, valueToCompare) || evaluateEquals(value, valueToCompare);

/**
 * Whether the field holds the rule's value: a case-insensitive substring of a text, or an entry of a list.
 *
 * The list reading is what anybody means by "the picks contain rpg", and until it existed the rule was simply false
 * against every array — so a flow gated on a list never ran, and nothing said why. An entry is matched the way `=`
 * matches, so `'3'` finds `3` and `'true'` finds `true`.
 */
export const evaluateContains = (value: RuleValue, valueToCompare: RuleValue) => {
  if (Array.isArray(valueToCompare)) {
    return valueToCompare.some((entry: RuleValue) => evaluateEquals(value, entry));
  }

  return (
    typeof value === 'string' &&
    typeof valueToCompare === 'string' &&
    valueToCompare.toLowerCase().includes(value.toLowerCase())
  );
};

export const evaluateBeginsWith = (value: RuleValue, valueToCompare: RuleValue) =>
  typeof valueToCompare === 'string' &&
  typeof value === 'string' &&
  valueToCompare.toLowerCase().startsWith(value.toLowerCase());

export const evaluateEndsWith = (value: RuleValue, valueToCompare: RuleValue) =>
  typeof valueToCompare === 'string' &&
  typeof value === 'string' &&
  valueToCompare.toLowerCase().endsWith(value.toLowerCase());

export const evaluateEmpty = (valueToCompare: RuleValue) => {
  switch (typeof valueToCompare) {
    case 'boolean':
    case 'number':
    case 'function':
      return false;

    case 'object':
    case 'undefined':
      if (valueToCompare === undefined || valueToCompare === null) {
        return true;
      }

      return Object.keys(valueToCompare).length === 0;

    default:
      return !valueToCompare;
  }
};

export const evaluateIn = (value: RuleValue, valueToCompare: RuleValue) => {
  if (typeof value === 'string' && value.includes(',')) {
    value = value.split(',').map(v => v.trim());
  } else if (typeof value === 'string' || typeof value === 'number') {
    value = [value];
  }

  if (!Array.isArray(value)) {
    return false;
  }

  if (typeof valueToCompare === 'string' && valueToCompare.includes(',')) {
    valueToCompare = valueToCompare.split(',').map(v => v.trim());
  }

  if (Array.isArray(valueToCompare)) {
    return valueToCompare.some((r: RuleValue) => {
      if (isNumeric(r)) {
        return value.includes(`${r}`) || value.includes(parseFloat(r as string));
      }

      return value.includes(r);
    });
  }

  if (isNumeric(valueToCompare)) {
    return value.includes(`${valueToCompare}`) || value.includes(parseFloat(valueToCompare as string));
  }

  return value.includes(valueToCompare);
};

export const evaluateBetween = (value: RuleValue, valueToCompare: RuleValue) => {
  let valueArr: string[] = [];
  if (typeof value === 'string') {
    valueArr = value.split(',').map(v => v.trim());
  }

  if (valueArr.length < 2) {
    return false;
  }

  return (
    evaluateGreaterThanOrEqual(valueArr[0], valueToCompare) && evaluateLessThanOrEqual(valueArr[1], valueToCompare)
  );
};

const evaluateField = (rule: Rule, values: { [key: string]: RuleValue }) => {
  const { field, operator, isBinding } = rule;
  let { value } = rule;
  const valueToCompare = get(values, field);
  if (isBinding) {
    value = get(values, rule.value);
  }

  switch (operator) {
    case '=':
      return evaluateEquals(value, valueToCompare);
    case '!=':
      return !evaluateEquals(value, valueToCompare);
    case '<':
      return evaluateLessThan(value, valueToCompare);
    case '>':
      return evaluateGreaterThan(value, valueToCompare);
    case '<=':
      return evaluateLessThanOrEqual(value, valueToCompare);
    case '>=':
      return evaluateGreaterThanOrEqual(value, valueToCompare);
    case 'contains':
      return evaluateContains(value, valueToCompare);
    case 'doesNotContain':
      return !evaluateContains(value, valueToCompare);
    case 'beginsWith':
      return evaluateBeginsWith(value, valueToCompare);
    case 'doesNotBeginWith':
      return !evaluateBeginsWith(value, valueToCompare);
    case 'endsWith':
      return evaluateEndsWith(value, valueToCompare);
    case 'doesNotEndWith':
      return !evaluateEndsWith(value, valueToCompare);
    case 'empty':
      return evaluateEmpty(valueToCompare);
    case 'notEmpty':
      return !evaluateEmpty(valueToCompare);
    case 'in':
      return evaluateIn(value, valueToCompare);
    case 'notIn':
      return !evaluateIn(value, valueToCompare);
    case 'between':
      return evaluateBetween(value, valueToCompare);
    case 'notBetween':
      return !evaluateBetween(value, valueToCompare);
    default:
      return false;
  }
};

const evaluate = (
  query?: RuleGroup,
  values: { [key: string]: RuleValue } = {},
  granulated = false,
  fallbackValue = false
): NestedBoolean => {
  if (!query) {
    return fallbackValue;
  }

  const { combinator, rules, enabled } = query;
  if (!Array.isArray(rules)) {
    // no rules to validate
    return fallbackValue;
  }

  if (enabled === false) {
    return true;
  }

  const isValid = rules
    .filter(rule => rule.enabled !== false)
    .map(rule => {
      if ('rules' in rule) {
        return evaluate(rule, values, granulated);
      }

      return evaluateField(rule, values);
    });

  if (!granulated) {
    if (combinator === 'and') {
      return !isValid.includes(false);
    }

    return isValid.includes(true);
  }

  return isValid;
};

export const evaluateRules = (
  queryRAW: RuleGroup,
  values: { [key: string]: RuleValue } = {},
  granulated = false,
  fallbackValue = false
) => {
  const query = transformQuery(queryRAW);

  return evaluate(query, values, granulated, fallbackValue);
};

const evaluateValuesRequired = (
  query: RuleGroup,
  values: { [key: string]: RuleValue },
  fallbackValue: unknown,
  isSubQuery = false
): { [key: string]: RuleValue } | Rule[] => {
  const { rules, enabled } = query;
  if (!Array.isArray(rules)) {
    return {}; // no rules to validate
  }

  if (enabled === false) {
    return {};
  }

  const allRules = rules
    .filter(rule => rule.enabled !== false)
    .flatMap(rule => {
      if ('rules' in rule) {
        return evaluateValuesRequired(rule, values, fallbackValue, true) as Rule[];
      }

      return rule;
    });

  if (isSubQuery) {
    return allRules;
  }

  return allRules.reduce((acum, rule) => {
    const { field, isBinding, value } = rule;
    if (isBinding) {
      set(acum, value, get(values, value, fallbackValue));
    }

    set(acum, field, get(values, field, fallbackValue));

    return acum;
  }, {});
};

export const getValuesRequired = (
  queryRAW: RuleGroup,
  values: { [key: string]: RuleValue } = {},
  fallbackValue = undefined
) => {
  const query = transformQuery(queryRAW);

  return evaluateValuesRequired(query as RuleGroup, values, fallbackValue);
};
