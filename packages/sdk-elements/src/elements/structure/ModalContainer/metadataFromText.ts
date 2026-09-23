/**
 * What `openModal('modal', '{{ row.id }}')` hands the modal: a JSON object is its fields, anything else is `content`.
 *
 * Numeric ids are the common case, and `'42'` parses as JSON too — as the number. Set as the modal's data whole, it
 * had no `content` and every binding inside read nothing.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const metadataFromText = (metadata: string): Record<string, unknown> => {
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
