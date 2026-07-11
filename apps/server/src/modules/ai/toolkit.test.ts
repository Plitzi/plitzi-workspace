import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { zodToJsonSchema, getAllowedModes, toolResponseOk, toolResponseErr } from './toolkit';

describe('zodToJsonSchema', () => {
  it('converts a flat ZodObject with its required fields', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const result = zodToJsonSchema(schema);

    expect(result).toMatchObject({
      type: 'object',
      properties: { name: { type: 'string' }, age: { type: 'number' } },
      required: ['name', 'age']
    });
  });

  it('marks optional fields as not required', () => {
    const schema = z.object({ required: z.string(), optional: z.string().optional() });
    const result = zodToJsonSchema(schema) as { required: string[] };

    expect(result.required).toContain('required');
    expect(result.required).not.toContain('optional');
  });

  it('converts primitives, enums and arrays', () => {
    expect(zodToJsonSchema(z.string())).toMatchObject({ type: 'string' });
    expect(zodToJsonSchema(z.number())).toMatchObject({ type: 'number' });
    expect(zodToJsonSchema(z.boolean())).toMatchObject({ type: 'boolean' });
    expect(zodToJsonSchema(z.enum(['a', 'b', 'c']))).toMatchObject({ enum: ['a', 'b', 'c'] });
    expect(zodToJsonSchema(z.array(z.string()))).toMatchObject({ type: 'array', items: { type: 'string' } });
    expect(zodToJsonSchema(z.record(z.string(), z.number()))).toMatchObject({
      type: 'object',
      additionalProperties: { type: 'number' }
    });
  });

  it('unwraps ZodOptional to its inner type', () => {
    expect(zodToJsonSchema(z.string().optional())).toMatchObject({ type: 'string' });
  });

  it('converts a union to anyOf branches', () => {
    const result = zodToJsonSchema(z.union([z.string(), z.number()])) as { anyOf: unknown[] };

    expect(result.anyOf).toEqual([{ type: 'string' }, { type: 'number' }]);
  });

  it('strips the $schema dialect marker so the provider payload stays minimal', () => {
    expect(zodToJsonSchema(z.object({ a: z.string() }))).not.toHaveProperty('$schema');
  });

  it('preserves .describe() text on both fields and object branches', () => {
    const schema = z.object({ ref: z.string().describe('the element ref') }).describe('update an element');
    const result = zodToJsonSchema(schema) as {
      description?: string;
      properties: { ref: { description?: string } };
    };

    expect(result.description).toBe('update an element');
    expect(result.properties.ref.description).toBe('the element ref');
  });

  it('emits a literal as a const, so a discriminated-union branch shows its type value', () => {
    const schema = z.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), x: z.string() }),
      z.object({ type: z.literal('b'), y: z.number() })
    ]);
    const result = zodToJsonSchema(schema) as { oneOf: Array<{ properties: { type: { const: string } } }> };

    expect(result.oneOf.map(b => b.properties.type.const).sort()).toEqual(['a', 'b']);
  });

  it('degrades an unrepresentable type to an empty schema instead of throwing', () => {
    expect(() => zodToJsonSchema(z.date())).not.toThrow();
    expect(zodToJsonSchema(z.date())).toEqual({});
  });
});

describe('getAllowedModes', () => {
  it('returns [plan, build] for read operations', () => {
    expect(getAllowedModes('read')).toEqual(['plan', 'build']);
  });

  it('returns [build] for write operations', () => {
    expect(getAllowedModes('write')).toEqual(['build']);
  });
});

describe('toolResponseOk', () => {
  it('serializes data as JSON text when no agentMessage is provided', () => {
    const data = { id: '1', name: 'Test' };
    const result = toolResponseOk(data);

    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
    expect(result.data).toEqual(data);
  });

  it('uses agentMessage as text when provided', () => {
    const result = toolResponseOk({ id: '1' }, 'Record created successfully.');

    expect(result.content[0].text).toBe('Record created successfully.');
  });

  it('does not set isError', () => {
    const result = toolResponseOk({ ok: true }) as Record<string, unknown>;

    expect(result.isError).toBeUndefined();
  });
});

describe('toolResponseErr', () => {
  it('returns error text from a string', () => {
    const result = toolResponseErr('Something went wrong');

    expect(result.content[0].text).toBe('Something went wrong');
    expect(result.isError).toBe(true);
  });

  it('returns error message from an Error object', () => {
    const result = toolResponseErr(new Error('DB error'));

    expect(result.content[0].text).toBe('DB error');
    expect(result.isError).toBe(true);
  });
});
