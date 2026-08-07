import { validateConnectorManifest } from '@plitzi/sdk-shared/connectors';

import type { ConnectorManifestDraft } from '@plitzi/sdk-shared';

export type ManifestValidation = {
  /** What blocks the save: the engine could not execute this manifest. */
  errors: string[];
  /** What saves but probably does not do what the author meant — shown, never blocking. */
  warnings: string[];
};

const describe = (issue: { path: string; message: string }): string =>
  issue.path ? `${issue.path}: ${issue.message}` : issue.message;

/**
 * Panel-facing wrapper over the one shared manifest validator.
 *
 * The rules themselves live in sdk-shared because three places apply them — this form, the MCP write ops and the
 * mutation that stores the row — and a manifest that the panel accepts but the server rejects is the worst of the
 * three outcomes. All this adds is the flat strings the form renders.
 */
export const validateManifest = (manifest: ConnectorManifestDraft): ManifestValidation => {
  const report = validateConnectorManifest(manifest);

  return { errors: report.errors.map(describe), warnings: report.warnings.map(describe) };
};
