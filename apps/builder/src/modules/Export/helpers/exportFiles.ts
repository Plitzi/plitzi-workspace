import JSZip from 'jszip';

import type { ExportFormat } from './exportFormats';
import type { SpaceDifference, SpecCorrection } from '@plitzi/sdk-authoring';

/**
 * A space, exported: the files it became and what happened on the way.
 *
 * Kept as plain data rather than as a download, because what is done with it differs by caller — copied into an editor,
 * saved as a file, handed to a deployment — and none of them should have to export the space again to do it.
 */
export type SpaceExport = {
  format: ExportFormat;
  /** What the export is saved as: the one file, or the archive holding several. */
  fileName: string;
  /** Source files by path. One entry unless the export was split. */
  files: Record<string, string>;
  /** What the export repaired in the space's documents. Empty for a JSON export, which changes nothing. */
  corrections: SpecCorrection[];
  /** How the exported code would differ from the space — each one a repair `corrections` names. */
  differences: SpaceDifference[];
};

/** The one file of a single-file export, which is what can be shown and copied. */
export const singleFileOf = (spaceExport: SpaceExport): string | undefined => {
  const contents = Object.values(spaceExport.files);

  return contents.length === 1 ? contents[0] : undefined;
};

const MIME_TYPES: Record<string, string> = { json: 'application/json', ts: 'text/plain' };

const mimeTypeOf = (fileName: string): string => MIME_TYPES[fileName.split('.').pop() ?? ''] ?? 'text/plain';

/** The export as one file to save: the file itself, or a zip of every file in its folder structure. */
export const exportBlob = async (spaceExport: SpaceExport): Promise<Blob> => {
  const single = singleFileOf(spaceExport);
  if (single !== undefined) {
    return new Blob([single], { type: mimeTypeOf(spaceExport.fileName) });
  }

  const zip = new JSZip();
  for (const [path, content] of Object.entries(spaceExport.files)) {
    zip.file(path, content);
  }

  return zip.generateAsync({ type: 'blob' });
};

/** Saves a blob through the browser's own download, under the given name. */
export const downloadBlob = (fileName: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  // After the click has handed the URL to the download, not before: revoking it synchronously can cancel the save.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const pathRank = (path: string): number => {
  if (path === 'index.ts') {
    return 0;
  }

  return path.includes('/') ? 2 : 1;
};

/** The files in reading order: the space first, then what sits beside it, then each folder's files by name. */
export const orderedPaths = (files: Record<string, string>): string[] =>
  Object.keys(files).sort((a, b) => pathRank(a) - pathRank(b) || a.localeCompare(b));
