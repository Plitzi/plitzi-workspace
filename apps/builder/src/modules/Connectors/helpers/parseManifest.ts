import type { ConnectorManifestDraft } from '@plitzi/sdk-shared';

export type ParseManifestResult =
  { manifest: ConnectorManifestDraft; error?: undefined } | { manifest?: undefined; error: string };

/**
 * Reads the advanced editor's text back into a manifest.
 *
 * The basic editor can only produce a well-formed document; hand-typed JSON can produce anything, so the shape is
 * checked before it reaches code that assumes it. `endpoints.list` is the one part with no default worth guessing:
 * a connector that cannot say how to read records is not a connector.
 */
export const parseManifest = (value: string): ParseManifestResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (err) {
    return { error: `The manifest is not valid JSON: ${(err as Error).message}` };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'A manifest must be a JSON object.' };
  }

  const draft = parsed as Partial<ConnectorManifestDraft>;
  if (!draft.endpoints?.list) {
    return { error: 'A manifest needs an "endpoints" block with a "list" describing how records are read.' };
  }

  return { manifest: draft as ConnectorManifestDraft };
};

export default parseManifest;
