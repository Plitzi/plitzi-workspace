import fs from 'node:fs/promises';
import path from 'node:path';

/** Every file under `folder` of `root`, by its path from `root`: none when there is no such folder. */
export const filesUnder = async (root: string, folder = ''): Promise<string[]> => {
  const entries = await fs.readdir(path.join(root, folder), { recursive: true, withFileTypes: true }).catch(() => []);

  return entries
    .filter(entry => entry.isFile())
    .map(entry => path.relative(root, path.join(entry.parentPath, entry.name)));
};
