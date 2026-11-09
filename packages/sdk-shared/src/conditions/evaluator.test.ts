import { describe, it, expect } from 'vitest';

import {
  evaluateBeginsWith,
  evaluateBetween,
  evaluateContains,
  evaluateEmpty,
  evaluateEndsWith,
  evaluateEquals,
  evaluateGreaterThan,
  evaluateGreaterThanOrEqual,
  evaluateIn,
  evaluateLessThan,
  evaluateLessThanOrEqual,
  transformQuery
} from './evaluator';

import type { RuleGroup } from './types';

/** Each operator of the rule evaluator, and the query it is read from — copied with it from plitzi-ui (RFC 0032, D13). */
describe('the rule evaluator’s operators', () => {
  it('should transform', () => {
    const queryRaw: RuleGroup = {
      id: '6533cb2b-f78c-4558-b9ae-ca4a16946680',
      combinator: 'and',
      rules: [
        {
          id: '1d6e3fe0-ea9c-4761-8a00-7c4f3b03fb7b',
          field: 'firstName',
          value: 'Stev',
          operator: 'beginsWith'
        },
        {
          id: '6c54e5ee-c982-4373-833d-1ae4887d5c10',
          field: 'lastName',
          value: 'Vai, Vaughan',
          operator: 'in'
        },
        {
          id: '0c9054ab-b8bd-4880-91b3-c9d4a70d2977',
          field: 'age',
          operator: '>',
          value: '28'
        },
        {
          id: '8949338f-2d87-408c-947d-f7eab73b505e',
          combinator: 'or',
          rules: [
            {
              id: '21b87854-8a51-4957-8b7d-87e2e2f35a88',
              field: 'isMusician',
              operator: '=',
              value: true
            },
            {
              id: '4a9352d7-9756-4096-b655-64fafb551cb0',
              field: 'instrument',
              operator: '=',
              value: 'Guitar'
            }
          ]
        },
        {
          id: 'fbd73b31-d57f-4e1c-8175-e2fe5f12fae7',
          field: 'birthdate',
          operator: 'between',
          value: '1954-10-03,1960-06-06'
        }
      ]
    };

    const query = transformQuery(queryRaw);

    expect(query).toEqual({
      combinator: 'and',
      rules: [
        {
          field: 'firstName',
          value: 'Stev',
          operator: 'beginsWith'
        },
        {
          field: 'lastName',
          value: 'Vai, Vaughan',
          operator: 'in'
        },
        {
          field: 'age',
          operator: '>',
          value: '28'
        },
        {
          combinator: 'or',
          rules: [
            {
              field: 'isMusician',
              operator: '=',
              value: true
            },
            {
              field: 'instrument',
              operator: '=',
              value: 'Guitar'
            }
          ]
        },
        {
          field: 'birthdate',
          operator: 'between',
          value: '1954-10-03,1960-06-06'
        }
      ]
    });
  });

  it('should evaluate equals', () => {
    expect(evaluateEquals('a', 'a')).toEqual(true);
    expect(evaluateEquals('a', 1)).toEqual(false);
    expect(evaluateEquals('hello world', 'Hello World')).toEqual(false);
    expect(evaluateEquals(5, 5)).toEqual(true);
    expect(evaluateEquals('05', 5)).toEqual(false);
    expect(evaluateEquals('05', '005')).toEqual(false);
    expect(evaluateEquals('5', 5)).toEqual(true);
    expect(evaluateEquals(0.5, 0.5)).toEqual(true);
    expect(evaluateEquals(0.5, 0.25)).toEqual(false);
    expect(evaluateEquals(true, true)).toEqual(true);
    expect(evaluateEquals(false, true)).toEqual(false);
    expect(evaluateEquals('', null)).toEqual(false);
    expect(evaluateEquals(undefined, null)).toEqual(false);
    expect(evaluateEquals(undefined, undefined)).toEqual(true);
    expect(evaluateEquals(true, 'true')).toEqual(true);
    expect(evaluateEquals(false, 'false')).toEqual(true);
    expect(evaluateEquals(true, 'false')).toEqual(false);
    expect(evaluateEquals(false, 'true')).toEqual(false);
    expect(evaluateEquals(true, '1')).toEqual(true);
    expect(evaluateEquals(false, '0')).toEqual(true);
    expect(evaluateEquals(true, '0')).toEqual(false);
    expect(evaluateEquals(false, '1')).toEqual(false);
    expect(evaluateEquals('true', true)).toEqual(true);
    expect(evaluateEquals('false', false)).toEqual(true);
    expect(evaluateEquals('false', true)).toEqual(false);
    expect(evaluateEquals('true', false)).toEqual(false);
    expect(evaluateEquals('1', true)).toEqual(true);
    expect(evaluateEquals('0', false)).toEqual(true);
    expect(evaluateEquals('0', true)).toEqual(false);
    expect(evaluateEquals('1', false)).toEqual(false);
  });

  it('should evaluate greater than', () => {
    expect(evaluateGreaterThan(3, 5)).toEqual(true);
    expect(evaluateGreaterThan(5, 5)).toEqual(false);
    expect(evaluateGreaterThan('a', 'a')).toEqual(false);
    expect(evaluateGreaterThan(2.99, 3)).toEqual(true);
    expect(evaluateGreaterThan(3.1, 4.5)).toEqual(true);
    expect(evaluateGreaterThan('a', 'b')).toEqual(true);
    expect(evaluateGreaterThan('2022-01-01', '2023-01-01')).toEqual(true);
    expect(evaluateGreaterThan('05', '005')).toEqual(false);
  });

  it('should evaluate greater than or equal', () => {
    expect(evaluateGreaterThanOrEqual(3, 5)).toEqual(true);
    expect(evaluateGreaterThanOrEqual(5, 5)).toEqual(true);
    expect(evaluateGreaterThanOrEqual('a', 'a')).toEqual(true);
    expect(evaluateGreaterThanOrEqual(2.99, 3)).toEqual(true);
    expect(evaluateGreaterThanOrEqual(3.1, 4.5)).toEqual(true);
    expect(evaluateGreaterThanOrEqual('a', 'b')).toEqual(true);
    expect(evaluateGreaterThanOrEqual('2022-01-01', '2023-01-01')).toEqual(true);
    expect(evaluateGreaterThanOrEqual('05', '005')).toEqual(false);
  });

  it('should evaluate less than', () => {
    expect(evaluateLessThan(5, 3)).toEqual(true);
    expect(evaluateLessThan(5, 5)).toEqual(false);
    expect(evaluateLessThan('a', 'a')).toEqual(false);
    expect(evaluateLessThan(3, 2.99)).toEqual(true);
    expect(evaluateLessThan(4.5, 3.1)).toEqual(true);
    expect(evaluateLessThan('b', 'a')).toEqual(true);
    expect(evaluateLessThan('2023-01-01', '2022-01-01')).toEqual(true);
    expect(evaluateLessThan('005', '05')).toEqual(false);
  });

  it('should evaluate less than or equal', () => {
    expect(evaluateLessThanOrEqual(5, 3)).toEqual(true);
    expect(evaluateLessThanOrEqual(5, 5)).toEqual(true);
    expect(evaluateLessThanOrEqual('a', 'a')).toEqual(true);
    expect(evaluateLessThanOrEqual(3, 2.99)).toEqual(true);
    expect(evaluateLessThanOrEqual(4.5, 3.1)).toEqual(true);
    expect(evaluateLessThanOrEqual('b', 'a')).toEqual(true);
    expect(evaluateLessThanOrEqual('2023-01-01', '2022-01-01')).toEqual(true);
    expect(evaluateLessThanOrEqual('005', '05')).toEqual(false);
  });

  it('should evaluate begins with', () => {
    expect(evaluateBeginsWith('hel', 'hello world')).toEqual(true);
    expect(evaluateBeginsWith('hel', 'Hello world')).toEqual(true);
    expect(evaluateBeginsWith('hel', 'hillo world')).toEqual(false);
    expect(evaluateBeginsWith('test', 123)).toEqual(false);
    expect(evaluateBeginsWith('test', true)).toEqual(false);
    expect(evaluateBeginsWith('test', undefined)).toEqual(false);
    expect(evaluateBeginsWith('test', true)).toEqual(false);
  });

  it('should evaluate ends with', () => {
    expect(evaluateEndsWith('rld', 'hello world')).toEqual(true);
    expect(evaluateEndsWith('rld', 'hello woRlD')).toEqual(true);
    expect(evaluateEndsWith('rld', 'hello people')).toEqual(false);
    expect(evaluateEndsWith('test', 123)).toEqual(false);
    expect(evaluateEndsWith('test', true)).toEqual(false);
    expect(evaluateEndsWith('test', undefined)).toEqual(false);
    expect(evaluateEndsWith('test', true)).toEqual(false);
  });

  it('should evaluate contains', () => {
    expect(evaluateContains('hel', 'hello world')).toEqual(true);
    expect(evaluateContains('hel', 'Hello world')).toEqual(true);
    expect(evaluateContains('hel', 'hillo world')).toEqual(false);
    expect(evaluateContains('test', 123)).toEqual(false);
    expect(evaluateContains('test', true)).toEqual(false);
    expect(evaluateContains('test', undefined)).toEqual(false);
    expect(evaluateContains('test', true)).toEqual(false);
  });

  it('should evaluate contains against a list as membership', () => {
    expect(evaluateContains('rpg', ['arcade', 'rpg'])).toEqual(true);
    expect(evaluateContains('racer', ['arcade', 'rpg'])).toEqual(false);
    expect(evaluateContains('3', [1, 3])).toEqual(true);
    expect(evaluateContains('true', [true])).toEqual(true);
    // An entry, not a substring of one: a list of words is not searched inside each word.
    expect(evaluateContains('rp', ['arcade', 'rpg'])).toEqual(false);
    expect(evaluateContains('rpg', [])).toEqual(false);
  });

  it('should evaluate empty', () => {
    expect(evaluateEmpty(true)).toEqual(false);
    expect(evaluateEmpty(false)).toEqual(false);
    expect(evaluateEmpty(0)).toEqual(false);
    expect(evaluateEmpty('')).toEqual(true);
    expect(evaluateEmpty({})).toEqual(true);
    expect(evaluateEmpty([])).toEqual(true);
    expect(evaluateEmpty(undefined)).toEqual(true);
    expect(evaluateEmpty(null)).toEqual(true);
  });

  it('should evaluate in', () => {
    expect(evaluateIn('1,2,3', '1')).toEqual(true);
    expect(evaluateIn('1,2,3', 1)).toEqual(true);
    expect(evaluateIn('1,2,3', '1,2')).toEqual(true);
    expect(evaluateIn('1,2,3', [1, 2])).toEqual(true);
    expect(evaluateIn([1, 2, 3], '1')).toEqual(true);
    expect(evaluateIn([1, 2, 3], '1')).toEqual(true);
    expect(evaluateIn([1, 2, 3], 1)).toEqual(true);
    expect(evaluateIn([1, 2, 3], '1,2')).toEqual(true);
    expect(evaluateIn([1, 2, 3], [1, 2])).toEqual(true);
    expect(evaluateIn('1.2.3', '1')).toEqual(false);
    expect(evaluateIn('1,2,3', true)).toEqual(false);
    expect(evaluateIn('1,2,3', '')).toEqual(false);
    expect(evaluateIn('1,2,3', undefined)).toEqual(false);
    expect(evaluateIn('1,2,3', null)).toEqual(false);
    expect(evaluateIn('1,2,3', 5)).toEqual(false);
    expect(evaluateIn('1,2,3', '5')).toEqual(false);
  });

  it('should evaluate between', () => {
    expect(evaluateBetween('1,5', '3')).toEqual(true);
    expect(evaluateBetween('1,5', 3)).toEqual(true);
    expect(evaluateBetween('1954-10-03,1960-06-06', '1955-10-04')).toEqual(true);
    expect(evaluateBetween('1,5', 55)).toEqual(false);
    expect(evaluateBetween('1,5', '03')).toEqual(true);
    expect(evaluateBetween('1,5', '0,3')).toEqual(false);
  });
});
