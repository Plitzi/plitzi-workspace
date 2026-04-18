import fs from 'node:fs/promises';
import path from 'node:path';

export const copyPlugin = async (src: string, destDir: string, filename: string): Promise<void> => {
  const dest = path.join(destDir, filename);

  if (src.startsWith('http://') || src.startsWith('https://')) {
    const res = await fetch(src);
    if (!res.ok) {
      throw new Error(`[SSR] Plugin fetch failed ${src}: ${res.status}`);
    }

    await fs.writeFile(dest, await res.text(), 'utf-8');
  } else {
    await fs.copyFile(src, dest);
  }
};
