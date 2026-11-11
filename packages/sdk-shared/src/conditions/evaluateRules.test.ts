import { describe, it, expect } from 'vitest';

import { evaluateRules, getValuesRequired } from './evaluator';

import type { RuleGroup } from './types';

/** Whole rule groups evaluated, and what they need — copied with the evaluator from plitzi-ui (docs/en/server-packages.md, D13). */
describe('a rule group, evaluated', () => {
  it('should evaluate', () => {
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
            },
            {
              id: '4a9352d7-9756-4096-b655-64fafb551cb0',
              field: 'nested.gender',
              operator: '=',
              value: 'Male'
            }
          ]
        },
        {
          id: 'fbd73b31-d57f-4e1c-8175-e2fe5f12fae7',
          field: 'birthdate',
          operator: 'between',
          value: '1954-10-03,1960-06-06'
        },
        {
          id: 'bd73b31-d57f-4e1c-8175-e2fe5f12fat',
          field: 'firstName_repeat',
          value: 'Stev',
          operator: 'beginsWith'
        },
        {
          id: 'bd73b31-d57f-4e1c-8175-e2fe5f12fa2',
          field: 'firstName',
          operator: '=',
          isBinding: true,
          value: 'firstName_repeat'
        }
      ]
    };

    let isValid = evaluateRules(
      queryRaw,
      {
        firstName: 'Steven',
        lastName: 'Vai',
        age: '29',
        isMusician: true,
        instrument: '',
        birthdate: '1955-10-04',
        nested: { gender: 'Male' },
        firstName_repeat: 'Steven'
      },
      true
    );
    expect(isValid).toEqual([true, true, true, [true, false, true], true, true, true]);

    isValid = evaluateRules(queryRaw, {
      firstName: 'Steven',
      lastName: 'Vai',
      age: '29',
      isMusician: true,
      instrument: '',
      birthdate: '1955-10-04',
      firstName_repeat: 'Steven'
    });
    expect(isValid).toEqual(true);

    isValid = evaluateRules(queryRaw, {
      firstName: 'Steven',
      lastName: 'Vai',
      age: '29',
      isMusician: false,
      instrument: '',
      birthdate: '1955-10-04'
    });
    expect(isValid).toEqual(false);

    isValid = evaluateRules(queryRaw, {
      firstName: 'Steven',
      lastName: 'Vai',
      age: '29',
      isMusician: true,
      instrument: '',
      birthdate: '1995-10-04'
    });
    expect(isValid).toEqual(false);

    isValid = evaluateRules(queryRaw, {
      firstName: 'Tester',
      lastName: 'Vai',
      age: '29',
      isMusician: true,
      instrument: '',
      birthdate: '1955-10-04'
    });
    expect(isValid).toEqual(false);

    isValid = evaluateRules(queryRaw, {});
    expect(isValid).toEqual(false);

    isValid = evaluateRules(queryRaw, undefined);
    expect(isValid).toEqual(false);

    // @ts-expect-error invalid value
    isValid = evaluateRules(queryRaw, null);
    expect(isValid).toEqual(false);

    // @ts-expect-error invalid value
    isValid = evaluateRules([], {
      firstName: 'Steven',
      lastName: 'Vai',
      age: '29',
      isMusician: true,
      instrument: '',
      birthdate: '1955-10-04',
      firstName_repeat: 'Steven'
    });
    expect(isValid).toEqual(false);

    isValid = evaluateRules(
      // @ts-expect-error invalid value
      {},
      {
        firstName: 'Steven',
        lastName: 'Vai',
        age: '29',
        isMusician: true,
        instrument: '',
        birthdate: '1955-10-04',
        firstName_repeat: 'Steven'
      }
    );
    expect(isValid).toEqual(false);

    // @ts-expect-error invalid value
    isValid = evaluateRules(null, {
      firstName: 'Steven',
      lastName: 'Vai',
      age: '29',
      isMusician: true,
      instrument: '',
      birthdate: '1955-10-04',
      firstName_repeat: 'Steven'
    });
    expect(isValid).toEqual(false);

    // @ts-expect-error invalid value
    isValid = evaluateRules(123, {
      firstName: 'Steven',
      lastName: 'Vai',
      age: '29',
      isMusician: true,
      instrument: '',
      birthdate: '1955-10-04',
      firstName_repeat: 'Steven'
    });
    expect(isValid).toEqual(false);

    // @ts-expect-error invalid value
    isValid = evaluateRules(undefined, {
      firstName: 'Steven',
      lastName: 'Vai',
      age: '29',
      isMusician: true,
      instrument: '',
      birthdate: '1955-10-04',
      firstName_repeat: 'Steven'
    });
    expect(isValid).toEqual(false);

    // @ts-expect-error invalid value
    isValid = evaluateRules('qwe', {
      firstName: 'Steven',
      lastName: 'Vai',
      age: '29',
      isMusician: true,
      instrument: '',
      birthdate: '1955-10-04',
      firstName_repeat: 'Steven'
    });
    expect(isValid).toEqual(false);

    isValid = evaluateRules({} as RuleGroup, {}, false, true);
    expect(isValid).toEqual(true);
  });

  it('should evaluate complex in', () => {
    const queryRaw: RuleGroup = {
      id: 'b643ebea-4ed3-4ad7-b1d8-d6c3f96322d2',
      combinator: 'and',
      rules: [
        {
          id: '64a695d5-12be-4e00-808d-3ac9920ba9e1',
          field: 'user.details.permissions',
          operator: 'in',
          value: 'spaceIndex'
        }
      ]
    };

    const isValid = evaluateRules(queryRaw, {
      user: {
        isAuthenticated: true,
        accessToken: '',
        details: {
          username: 'demo',
          email: 'demo@demo.com',
          permissions: ['siteIndex', 'spaceDelete', 'spaceIndex', 'spaceUpdate', 'spaceView'],
          verified: true,
          id: 0
        }
      }
    });
    expect(isValid).toEqual(true);
  });

  it('should evaluate nested objects', () => {
    const queryRaw: RuleGroup = {
      id: '6533cb2b-f78c-4558-b9ae-ca4a16946680',
      combinator: 'and',
      rules: [
        {
          id: '1d6e3fe0-ea9c-4761-8a00-7c4f3b03fb7b',
          field: 'nested.firstName',
          value: 'Stev',
          operator: 'beginsWith'
        },
        {
          id: '6c54e5ee-c982-4373-833d-1ae4887d5c10',
          field: 'nested.lastName',
          value: 'Vai, Vaughan',
          operator: 'in'
        },
        {
          id: '0c9054ab-b8bd-4880-91b3-c9d4a70d2977',
          field: 'nested.age',
          operator: '>',
          value: '28'
        },
        {
          id: '8949338f-2d87-408c-947d-f7eab73b505e',
          combinator: 'or',
          rules: [
            {
              id: '21b87854-8a51-4957-8b7d-87e2e2f35a88',
              field: 'nested.isMusician',
              operator: '=',
              value: true
            },
            {
              id: '4a9352d7-9756-4096-b655-64fafb551cb0',
              field: 'nested.instrument',
              operator: '=',
              value: 'Guitar'
            }
          ]
        },
        {
          id: 'fbd73b31-d57f-4e1c-8175-e2fe5f12fae7',
          field: 'nested.birthdate',
          operator: 'between',
          value: '1954-10-03,1960-06-06'
        }
      ]
    };

    let isValid = evaluateRules(
      queryRaw,
      {
        nested: {
          firstName: 'Steven',
          lastName: 'Vai',
          age: '29',
          isMusician: true,
          instrument: '',
          birthdate: '1955-10-04'
        }
      },
      true
    );
    expect(isValid).toEqual([true, true, true, [true, false], true]);

    isValid = evaluateRules(queryRaw, {
      nested: {
        firstName: 'Steven',
        lastName: 'Vai',
        age: '29',
        isMusician: true,
        instrument: '',
        birthdate: '1955-10-04'
      }
    });
    expect(isValid).toEqual(true);
  });

  it('should evaluate and some are disabled', () => {
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
          enabled: false,
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
            },
            {
              id: '4a9352d7-9756-4096-b655-64fafb551cb0',
              field: 'nested.gender',
              operator: '=',
              value: 'Male'
            }
          ]
        },
        {
          id: 'fbd73b31-d57f-4e1c-8175-e2fe5f12fae7',
          field: 'birthdate',
          operator: 'between',
          value: '1954-10-03,1960-06-06'
        },
        {
          id: 'bd73b31-d57f-4e1c-8175-e2fe5f12fat',
          field: 'firstName_repeat',
          value: 'Stev',
          operator: 'beginsWith',
          enabled: false
        },
        {
          id: 'bd73b31-d57f-4e1c-8175-e2fe5f12fa2',
          field: 'firstName',
          operator: '=',
          isBinding: true,
          value: 'firstName_repeat'
        }
      ]
    };

    let isValid = evaluateRules(
      queryRaw,
      {
        firstName: 'Steven',
        lastName: 'Vai',
        age: '29',
        isMusician: true,
        instrument: '',
        birthdate: '1955-10-04',
        nested: { gender: 'Male' },
        firstName_repeat: 'Steven'
      },
      true
    );
    expect(isValid).toEqual([true, true, true, true, true]);

    isValid = evaluateRules(queryRaw, {
      firstName: 'Steven',
      lastName: 'Vai',
      age: '29',
      isMusician: true,
      instrument: '',
      birthdate: '1955-10-04',
      firstName_repeat: 'Steven'
    });
    expect(isValid).toEqual(true);
  });

  it('should getValuesRequired', () => {
    const queryRaw: RuleGroup = {
      id: '6533cb2b-f78c-4558-b9ae-ca4a16946680',
      combinator: 'and',
      rules: [
        {
          id: '1d6e3fe0-ea9c-4761-8a00-7c4f3b03fb7b',
          field: 'nested.firstName',
          value: 'Stev',
          operator: 'beginsWith'
        },
        {
          id: '6c54e5ee-c982-4373-833d-1ae4887d5c10',
          field: 'nested.lastName',
          value: 'Vai, Vaughan',
          operator: 'in'
        },
        {
          id: '0c9054ab-b8bd-4880-91b3-c9d4a70d2977',
          field: 'nested.age',
          operator: '>',
          value: '28'
        },
        {
          id: '8949338f-2d87-408c-947d-f7eab73b505e',
          combinator: 'or',
          rules: [
            {
              id: '21b87854-8a51-4957-8b7d-87e2e2f35a88',
              field: 'nested.isMusician',
              operator: '=',
              value: true
            },
            {
              id: '4a9352d7-9756-4096-b655-64fafb551cb0',
              field: 'nested.instrument',
              operator: '=',
              value: 'Guitar'
            }
          ]
        },
        {
          id: 'fbd73b31-d57f-4e1c-8175-e2fe5f12fae7',
          field: 'nested.birthdate',
          operator: 'between',
          value: '1954-10-03,1960-06-06'
        }
      ]
    };

    let previewValues = getValuesRequired(queryRaw, {
      nested: {
        firstName: 'Steven',
        lastName: 'Vai',
        age: '29',
        isMusician: true,
        instrument: '',
        birthdate: '1955-10-04',
        fakeVariable: 'isNotUsed',
        nested2: {
          fakeVariable2: 'isNotUsed2'
        }
      }
    });
    expect(previewValues).toEqual({
      nested: {
        firstName: 'Steven',
        lastName: 'Vai',
        age: '29',
        isMusician: true,
        instrument: '',
        birthdate: '1955-10-04'
      }
    });

    previewValues = getValuesRequired(queryRaw, {
      nested: {
        // firstName: 'Steven',
        // lastName: 'Vai',
        age: '29',
        isMusician: true,
        instrument: '',
        birthdate: '1955-10-04',
        fakeVariable: 'isNotUsed',
        nested2: {
          fakeVariable2: 'isNotUsed2'
        }
      }
    });
    expect(previewValues).toEqual({
      nested: {
        firstName: undefined,
        lastName: undefined,
        age: '29',
        isMusician: true,
        instrument: '',
        birthdate: '1955-10-04'
      }
    });

    previewValues = getValuesRequired(
      queryRaw,
      {
        nested: {
          // firstName: 'Steven',
          // lastName: 'Vai',
          age: '29',
          isMusician: true,
          instrument: '',
          birthdate: '1955-10-04',
          fakeVariable: 'isNotUsed',
          nested2: {
            fakeVariable2: 'isNotUsed2'
          }
        }
      },
      undefined
    );
    expect(previewValues).toEqual({
      nested: {
        firstName: undefined,
        lastName: undefined,
        age: '29',
        isMusician: true,
        instrument: '',
        birthdate: '1955-10-04'
      }
    });
  });
});
