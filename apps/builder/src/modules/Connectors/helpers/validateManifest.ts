import type { ConnectorManifestDraft } from '@plitzi/sdk-shared';

const CREDENTIAL_TOKEN = /\{\{\s*credential\./;

const usesCredential = (manifest: ConnectorManifestDraft): boolean => {
  const templates = [
    manifest.auth?.value ?? '',
    manifest.endpoints.list.path,
    ...Object.values(manifest.endpoints.list.query ?? {}),
    ...Object.values(manifest.headers ?? {})
  ];

  return templates.some(template => CREDENTIAL_TOKEN.test(template));
};

/**
 * Catches the manifests that would save cleanly and then fail at request time.
 *
 * Every check here is something the engine cannot recover from: an empty base URL makes `new URL` throw, and a
 * template referencing a credential that was never picked resolves to an empty string, which authenticates as
 * nobody and reads as "the CMS rejected us" from the page. Failing in the panel names the actual cause.
 */
export const validateManifest = (manifest: ConnectorManifestDraft): string[] => {
  const errors: string[] = [];
  if (!manifest.baseUrl.trim()) {
    errors.push('Base URL is required.');
  } else if (!/^https?:\/\//.test(manifest.baseUrl)) {
    errors.push('Base URL must start with http:// or https://.');
  }

  if (!manifest.endpoints.list.path.trim()) {
    errors.push('The list endpoint needs a path.');
  }

  if (usesCredential(manifest) && !manifest.credential) {
    errors.push('This manifest reads {{credential.…}} but no credential is selected.');
  }

  if (manifest.pagination === 'cursor' && !JSON.stringify(manifest.endpoints.list.query ?? {}).includes('{{cursor}}')) {
    errors.push('Cursor paging needs {{cursor}} in the list query, otherwise every page is the first one.');
  }

  return errors;
};
