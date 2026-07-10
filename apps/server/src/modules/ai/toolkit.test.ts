import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { zodToJsonSchema, getAllowedModes, toolResponseOk, toolResponseErr } from './toolkit';

describe('zodToJsonSchema', () => {
  it('converts a flat ZodObject', () => {
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

  it('converts ZodString', () => {
    const result = zodToJsonSchema(z.string());

    expect(result).toEqual({ type: 'string' });
  });

  it('converts ZodNumber', () => {
    const result = zodToJsonSchema(z.number());

    expect(result).toEqual({ type: 'number' });
  });

  it('converts ZodBoolean', () => {
    const result = zodToJsonSchema(z.boolean());

    expect(result).toEqual({ type: 'boolean' });
  });

  it('converts ZodEnum', () => {
    const result = zodToJsonSchema(z.enum(['a', 'b', 'c']));

    expect(result).toEqual({ type: 'string', enum: ['a', 'b', 'c'] });
  });

  it('converts ZodOptional by unwrapping the inner type', () => {
    const result = zodToJsonSchema(z.string().optional());

    expect(result).toEqual({ type: 'string' });
  });

  it('converts ZodArray', () => {
    const result = zodToJsonSchema(z.array(z.string()));

    expect(result).toEqual({ type: 'array', items: { type: 'string' } });
  });

  it('converts ZodRecord', () => {
    const result = zodToJsonSchema(z.record(z.string(), z.number()));

    expect(result).toEqual({ type: 'object', additionalProperties: { type: 'number' } });
  });

  it('converts ZodUnion with oneOf', () => {
    const result = zodToJsonSchema(z.union([z.string(), z.number()])) as { oneOf: unknown[] };

    expect(result.oneOf).toHaveLength(2);
    expect(result.oneOf[0]).toEqual({ type: 'string' });
    expect(result.oneOf[1]).toEqual({ type: 'number' });
  });

  it('returns empty object for unknown types', () => {
    const result = zodToJsonSchema(z.null());

    expect(result).toEqual({});
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
