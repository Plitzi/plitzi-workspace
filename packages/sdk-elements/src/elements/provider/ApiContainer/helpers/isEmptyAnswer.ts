type ProviderSlice = { records?: unknown[]; record?: unknown; data?: unknown };

const isEmptyValue = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);

/**
 * Whether a provider has nothing to show, for each shape of answer it can hold.
 *
 * A connector list publishes `records`, a detail provider `record`, and a plain `query` the body it received under
 * `data`. Only the first two used to be asked, so a `query` — whose slice has no `records` at all — reported empty
 * whatever it held, and an empty state bound to `isEmpty` showed over a full page.
 *
 * `records` is the list after pagination has accumulated it, which is why it is passed in rather than read here.
 */
export const isEmptyAnswer = (slice: ProviderSlice, records: unknown[], singleRecord: boolean): boolean => {
  if (singleRecord) {
    return slice.record === undefined;
  }

  if (Array.isArray(slice.records)) {
    return records.length === 0;
  }

  return isEmptyValue(slice.data);
};
