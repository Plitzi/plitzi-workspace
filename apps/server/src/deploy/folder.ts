import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { SiteUploader, UploadResult } from './types';

/**
 * A site written into a folder of this machine — what `plitzi build --spa|--static` leaves for a customer's own CI to
 * ship, and the simplest provider to try a build with. A path that would leave the folder is refused, never written.
 */
export const folderUploader = (folder: string): SiteUploader => ({
  name: `the folder ${folder}`,
  atomic: false,
  upload: async (files, log, signal): Promise<UploadResult> => {
    const root = path.resolve(folder);
    let bytes = 0;
    for (const file of files) {
      signal?.throwIfAborted();
      const target = path.resolve(root, file.path);
      if (!target.startsWith(`${root}${path.sep}`)) {
        throw new Error(`${file.path} would be written outside ${folder}`);
      }

      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.body);
      bytes += file.body.byteLength;
    }

    log(`Wrote ${String(files.length)} files (${String(Math.round(bytes / 1024))} KB) to ${folder}`);

    return { files: files.length, bytes, reference: root };
  }
});
