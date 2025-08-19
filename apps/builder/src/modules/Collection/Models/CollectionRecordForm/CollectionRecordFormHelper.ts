import { z } from 'zod';

import type { collectionFieldSchema } from '../CollectionFieldForm';

export const collectionRecordBaseSchema = z.object({
  id: z.string(),
  status: z.enum(['draft', 'published', 'archived'])
  // values: z.record()
});

export function makeCollectionRecordSchema(fields?: z.infer<typeof collectionFieldSchema>[]) {
  if (!fields || fields.length === 0) {
    return collectionRecordBaseSchema.extend({
      values: z.object({})
    });
  }

  // Construir el shape de values dinámicamente
  const valuesShape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    switch (field.type) {
      case 'text':
      case 'richText':
      case 'email':
      case 'phone':
      case 'link':
      case 'color':
      case 'option':
        valuesShape[field.machineName] = z.string();
        break;

      case 'number':
        valuesShape[field.machineName] = z.number();
        break;

      case 'date':
        valuesShape[field.machineName] = z.date();
        break;

      case 'switch':
        valuesShape[field.machineName] = z.boolean();
        break;

      case 'image':
      case 'multiImage':
      case 'video':
      case 'file':
        valuesShape[field.machineName] = z.any(); // aquí puedes refinar más
        break;
    }

    if (!field.params.required) {
      valuesShape[field.machineName] = valuesShape[field.machineName].optional();
    }
  }

  return collectionRecordBaseSchema.extend({
    values: z.object(valuesShape)
  });
}
