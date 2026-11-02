import fs from 'node:fs/promises';

import type { Launch } from './launch';

/** What a launched session wrote, read back off its log: what it ended on, and when. */

/** What of a session's output is read: its end, where a harness says why it ended. */
const TAIL_BYTES = 8192;

/** The last line of a text that says something. */
export const lastLineOf = (text: string): string | undefined =>
  text
    .split('\n')
    .map(line => line.trim())
    .findLast(line => line !== '');

/** What a launch's session wrote, and when it last wrote: when its process ended, since nothing writes after. */
export const sessionOf = async (launch: Launch): Promise<{ text: string; endedAt: number } | undefined> => {
  const stat = await fs.stat(launch.log).catch(() => undefined);
  if (!stat) {
    return undefined;
  }

  const from = Math.max(launch.logFrom ?? 0, stat.size - TAIL_BYTES);
  const file = await fs.open(launch.log, 'r');
  try {
    const buffer = Buffer.alloc(Math.max(0, stat.size - from));
    await file.read(buffer, 0, buffer.length, from);

    return { text: buffer.toString('utf-8'), endedAt: stat.mtimeMs };
  } finally {
    await file.close();
  }
};

/** The line a launch's session ended on — none when it wrote nothing, or its log is gone. */
export const lastSessionLine = async (launch: Launch): Promise<string | undefined> => {
  const session = await sessionOf(launch);

  return session === undefined ? undefined : lastLineOf(session.text);
};
