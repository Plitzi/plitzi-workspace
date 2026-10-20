// Marker returned by `| raw` so the Evaluator bypasses JSON serialization and outputs the value as-is.
export type RawMarker = { readonly __raw: unknown; readonly __marker: typeof RAW_MARKER };

export const RAW_MARKER = '__PLITZI_RAW__';

export const isRawMarker = (value: unknown): value is RawMarker =>
  typeof value === 'object' && value !== null && (value as { __marker?: unknown }).__marker === RAW_MARKER;

export const wrapRaw = (value: unknown): RawMarker => ({ __raw: value, __marker: RAW_MARKER });

export const unwrapRaw = (value: unknown): unknown => (isRawMarker(value) ? value.__raw : value);
