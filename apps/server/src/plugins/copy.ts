import path from 'node:path';

import { copyFileAtomic, writeFileAtomic } from '../helpers/atomicFile';

export const copyPlugin = async (src: string, destDir: string, filename: string): Promise<void> => {
  const dest = path.join(destDir, filename);

  if (src.startsWith('http://') || src.startsWith('https://')) {
    const res = await fetch(src);
    if (!res.ok) {
      throw new Error(`[SSR] Plugin fetch failed ${src}: ${res.status}`);
    }

    await writeFileAtomic(dest, await res.text());
  } else {
    await copyFileAtomic(src, dest);
  }
};
