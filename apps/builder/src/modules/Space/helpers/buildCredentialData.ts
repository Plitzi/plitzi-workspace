import type { spaceCredentialFormSchema } from '@pmodules/Space/Models/SpaceCredentialForm';
import type z from 'zod';

/**
 * Turns a submitted credential form into the bag the API stores.
 *
 * Each provider keeps a different shape, and a `custom` credential keeps whatever keys its connector manifest names —
 * which is why the value is parsed here rather than typed: the set of keys is the author's, not ours.
 */
export const buildCredentialData = (values: z.infer<typeof spaceCredentialFormSchema>) => {
  if (values.provider === 'r2' || values.provider === 's3') {
    return { accessKeyId: values.accessKeyId, secretAccessKey: values.secretAccessKey };
  }

  if (values.provider === 'custom') {
    return JSON.parse(values.data) as Record<string, string>;
  }

  return values.fields;
};

export default buildCredentialData;
