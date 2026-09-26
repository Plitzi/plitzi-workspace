import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';

/**
 * Writes a file whole or not at all: to a temporary name beside it, then renamed over it.
 *
 * Several workers can build or download the same plugin into the same folder at once, and a reader can open a file
 * while another process is writing it. A rename replaces the file in one step, so whoever reads it sees the old
 * version or the new one — never half of either. Same-folder temporary, so the rename never crosses a filesystem.
 */
export const writeFileAtomic = async (file: string, data: string | Uint8Array): Promise<void> => {
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, data);
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
};

/** `copyFile`, with the same whole-or-nothing guarantee. */
export const copyFileAtomic = async (source: string, file: string): Promise<void> => {
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.copyFile(source, temporary);
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
};
