import { describe, expect, it } from 'vitest';

import { describeOperation } from './describeOperation';

describe('plitzi_describe_operation', () => {
  it('answers one operation with its whole schema', () => {
    const answer = describeOperation('patchElement') as { type: string; schema: { properties?: object } };

    expect(answer.type).toBe('patchElement');
    expect(answer.schema.properties).toHaveProperty('type');
    expect(answer.schema.properties).toHaveProperty('ref');
  });

  it('lists every type when it is asked for none', () => {
    const { types } = describeOperation(undefined) as { types: string[] };

    expect(types).toEqual(expect.arrayContaining(['upsertElement', 'patchDefinition', 'upsertConnector']));
  });

  // A model that guessed a name is told the nearest real one, and what to ask next — not left to guess again.
  it('answers a type that does not exist with the nearest one and the list', () => {
    const answer = describeOperation('upsertElemnt');

    expect(answer).toMatchObject({
      error: 'UNKNOWN_OPERATION',
      message: 'There is no "upsertElemnt" operation — did you mean "upsertElement"?',
      describe: { type: 'upsertElement' }
    });
    expect(answer.types).toEqual(expect.arrayContaining(['upsertElement']));
  });
});
