import type { ConnectorManifestDraft } from '@plitzi/sdk-shared';

const CREDENTIAL_TOKEN = /\{\{\s*credential\./;

const usesCredential = (manifest: ConnectorManifestDraft): boolean => {
  const reads = Object.values(manifest.endpoints.read);
  const writes = Object.values(manifest.endpoints.write ?? {});
  const templates = [
    manifest.auth?.value ?? '',
    ...Object.values(manifest.headers ?? {}),
    ...reads.flatMap(read => [read.path, ...Object.values(read.query ?? {}), ...Object.values(read.headers ?? {})]),
    ...writes.flatMap(write => [write.path, ...Object.values(write.query ?? {}), ...Object.values(write.headers ?? {})])
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

  const reads = Object.entries(manifest.endpoints.read);
  if (!reads.length) {
    errors.push('A connector needs at least one read endpoint.');
  }

  reads.forEach(([name, read]) => {
    if (!read.path.trim()) {
      errors.push(`Read endpoint "${name}" needs a path.`);
    }
  });

  Object.entries(manifest.endpoints.write ?? {}).forEach(([name, write]) => {
    if (!write.path.trim()) {
      errors.push(`Write endpoint "${name}" needs a path.`);
    }
  });

  if (usesCredential(manifest) && !manifest.credential) {
    errors.push('This manifest reads {{credential.…}} but no credential is selected.');
  }

  reads.forEach(([name, read]) => {
    const pagination = read.pagination ?? manifest.pagination;
    if (pagination === 'cursor' && !JSON.stringify(read.query ?? {}).includes('{{cursor}}')) {
      errors.push(`Cursor paging needs {{cursor}} in the query of "${name}", otherwise every page is the first one.`);
    }
  });

  return errors;
};
