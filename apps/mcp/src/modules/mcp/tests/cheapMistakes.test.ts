import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { buildSpace, capturing, checkBatch } from './helpers';
import { apply, applyShape } from '../tools';
import { applyTool } from '../tools/apply';

import type { Operation } from '../tools';

/** What the MCP SDK answers a call its schema refuses: each issue's message, at its path. */
const refusal = (operations: unknown[]): string => {
  const parsed = z.object(applyShape).safeParse({ operations });

  return parsed.success
    ? 'accepted'
    : parsed.error.issues.map(issue => `${issue.message} at ${issue.path.join('.')}`).join('\n');
};

// A small model pays for every attempt: a mistake is answered in a line, with the name it meant and where the rest is.
describe('a mistake costs one line', () => {
  it('answers an operation that does not exist with the nearest one', () => {
    expect(refusal([{ type: 'upsertElemnt', pageRef: 'home', element: { ref: 'x', type: 'text' } }])).toBe(
      'There is no "upsertElemnt" operation — did you mean "upsertElement"?: plitzi_describe_operation lists every type at operations.0.type'
    );
  });

  // A field the schema does not have used to be dropped: `prop` applied nothing, and the batch answered success.
  it('refuses a field an operation does not have, naming the one meant', () => {
    expect(refusal([{ type: 'patchElement', pageRef: 'home', ref: 'c1', prop: { content: 'x' } }])).toBe(
      'patchElement has no field "prop" (did you mean "props"?): plitzi_describe_operation { type: "patchElement" } lists its fields at operations.0'
    );
    expect(
      refusal([
        { type: 'upsertElement', pageRef: 'home', element: { ref: 'x', type: 'text', prop: { content: 'Hi' } } }
      ])
    ).toContain('An element has no field "prop" (did you mean "props"?)');
  });
});

describe('what has one reading is read that way, and said', () => {
  const heading: Operation[] = [
    { type: 'upsertElement', pageRef: 'home', element: { ref: 'title', type: 'Heading', props: { content: 'Hi' } } }
  ];

  it('reads an element type with other capitals as the type the catalog spells', async () => {
    const cap = capturing(buildSpace());
    const result = await apply({ operations: heading }, buildSpace(), cap.persisters);

    expect(result.applied).toBe(true);
    expect(cap.saved().schema.flat.title.definition.type).toBe('heading');
    expect(result.warnings).toContain(
      'Read element type "Heading" as "heading" (operations[0].element.type): write it as the catalog spells it.'
    );
  });

  it('guesses nothing between two names: a typo is warned of with the nearest one', () => {
    const { warnings } = checkBatch(
      { operations: [{ type: 'upsertElement', pageRef: 'home', element: { ref: 't', type: 'headng' } }] },
      buildSpace()
    );

    expect(warnings.some(warning => warning.includes('did you mean "heading"'))).toBe(true);
    expect(warnings.some(warning => warning.startsWith('Read element type'))).toBe(false);
  });
});

// A model is not trusted to notice it is going round in circles: the tool does.
describe('the same batch refused again', () => {
  it('says so the second time, and is not run the third', async () => {
    const ctx = { space: buildSpace(), env: 'main' as const, persisters: {}, spaceId: 9001 };
    const broken = { operations: [{ type: 'deleteElement', pageRef: 'ghost', ref: 'c1' }] };

    const first = (await applyTool.execute(broken, ctx)) as { errors?: unknown[]; again?: string };
    const second = (await applyTool.execute(broken, ctx)) as { errors?: unknown[]; again?: string };
    const third = (await applyTool.execute(broken, ctx)) as { error?: string };

    expect(first.errors?.length).toBeGreaterThan(0);
    expect(first.again).toBeUndefined();
    expect(second.again).toContain('Sending it again will not change the answer');
    expect(third.error).toBe('REPEATED_BATCH');
  });
});
