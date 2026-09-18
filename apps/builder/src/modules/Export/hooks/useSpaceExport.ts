import { use, useCallback } from 'react';

import useNetwork from '@plitzi/sdk-shared/hooks/useNetwork';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { useBuilderStoreGetter } from '@plitzi/sdk-shared/store';

import type { SpaceExport } from '../helpers/exportFiles';
import type { ExportFormat } from '../helpers/exportFormats';
import type { SpaceDifference, SpecCorrection } from '@plitzi/sdk-authoring';

type AuthoringResponse = {
  data?: {
    exportName: string;
    files: Record<string, string>;
    corrections: SpecCorrection[];
    differences: SpaceDifference[];
  };
  error?: string;
  /** Present on a plan refusal (402): the capability the plan does not include. */
  limit?: string;
};

/** What an export came to: the files, or why there are none — the plan, or anything else. */
export type SpaceExportResult =
  { ok: true; spaceExport: SpaceExport } | { ok: false; error: string; requiresPaidPlan: boolean };

/**
 * Exports the space the builder is showing, as it is on screen.
 *
 * The documents are the builder's own — the schema and the style it is editing — so the export is what the person sees,
 * not the last copy something else saved. JSON is written here, from data the builder already holds; the code is
 * written by the server (`/utils/transform-to-authoring`), which holds the reader, the formatter, the check that the
 * code authors the same space, and the plan gate. Anything that needs the space as files calls this.
 */
const useSpaceExport = () => {
  const { server, webKey } = use(NetworkContext);
  const { networkQuery } = useNetwork({ initLoading: false, server, webKey });
  const getSchema = useBuilderStoreGetter('schema');
  const getStyle = useBuilderStoreGetter('style');

  const exportSpace = useCallback(
    async (format: ExportFormat): Promise<SpaceExportResult> => {
      const schema = getSchema();
      const style = getStyle();

      if (format === 'json') {
        const fileName = `${schema.definition.permanentUrl || 'space'}.json`;

        return {
          ok: true,
          spaceExport: {
            format,
            fileName,
            files: { [fileName]: `${JSON.stringify({ schema, style }, null, 2)}\n` },
            corrections: [],
            differences: []
          }
        };
      }

      const split = format === 'authoring-split';
      const response = await networkQuery<AuthoringResponse>(
        '/utils/transform-to-authoring',
        { schema, style, split },
        'post'
      );
      if (!response?.data) {
        return {
          ok: false,
          error: response?.error ?? 'The server could not export this space.',
          requiresPaidPlan: response?.limit === 'spaceExport'
        };
      }

      const { exportName, files, corrections, differences } = response.data;
      if (split) {
        return { ok: true, spaceExport: { format, fileName: `${exportName}.zip`, files, corrections, differences } };
      }

      const fileName = `${exportName}.ts`;

      return {
        ok: true,
        spaceExport: { format, fileName, files: { [fileName]: files['index.ts'] }, corrections, differences }
      };
    },
    [getSchema, getStyle, networkQuery]
  );

  return { exportSpace };
};

export default useSpaceExport;
