import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

/**
 * What `openModal('modal', …)` — or `openDialog` — hands the container, as its data: an object is its fields, a JSON
 * object in text is too, and anything else is `content`.
 *
 * Numeric ids are the common case, and `'42'` parses as JSON too — as the number. Set as the container's data whole, it
 * had no `content` and every binding inside read nothing.
 */
export const metadataOf = (metadata: unknown): Record<string, unknown> => {
  if (isRecord(metadata)) {
    return metadata;
  }

  if (metadata === undefined || metadata === null) {
    return {};
  }

  if (typeof metadata !== 'string') {
    return { content: metadata };
  }

  try {
    const parsed: unknown = JSON.parse(metadata);
    if (isRecord(parsed)) {
      return parsed;
    }
  } catch {
    // Not JSON: plain text, which is what `content` is for.
  }

  return { content: metadata };
};
