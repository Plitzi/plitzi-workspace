import { z } from 'zod';

import { closest } from '@plitzi/sdk-authoring';

/**
 * Objects of the write vocabulary that refuse a field they do not have. One left out of a schema used to be dropped as
 * the batch was read — `prop` for `props` applied nothing and answered success, the one mistake an agent cannot see.
 * Refused instead, with the field meant and where every field is listed.
 */

/** What a field `owner` does not have is answered with: the nearest one it does, and where every one is listed. */
const unknownFields = (
  owner: string,
  written: readonly string[],
  fields: readonly string[],
  listed: string
): string => {
  const named = written.map(key => {
    const nearest = closest(key, fields);

    return nearest ? `"${key}" (did you mean "${nearest}"?)` : `"${key}"`;
  });

  return `${owner} has no field ${named.join(', ')}: ${listed} lists its fields`;
};

/** A part of an operation (`an element`), closed: its fields as `shape` declares them, and no other. */
export const closedObject = <Shape extends z.ZodRawShape>(owner: string, shape: Shape, listed: string) => {
  const fields = Object.keys(shape);

  return z.strictObject(shape, {
    error: issue => (issue.code === 'unrecognized_keys' ? unknownFields(owner, issue.keys, fields, listed) : undefined)
  });
};

/** An operation's type, as its schema states it. */
export const typeOf = (operation: z.ZodObject): string =>
  operation.shape.type instanceof z.ZodLiteral ? String(operation.shape.type.value) : '';

/** An operation, closed: its fields as declared, its description kept. */
export const closed = <Shape extends z.ZodRawShape>(operation: z.ZodObject<Shape>) => {
  const type = typeOf(operation);

  return closedObject(type, operation.shape, `plitzi_describe_operation { type: "${type}" }`).describe(
    operation.description ?? ''
  );
};
