import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';
import { PREVIEW_FILE_ENV, PREVIEW_SLUG } from '@plitzi/sdk-shared/project';

import { RunRefusal } from '../../../runs/core/refusal';

/**
 * `task look --alone <element> [--with <json>]…`: one element of the space drawn alone — a component with its props, a
 * plugin's element or a built-in with its attributes — on a page the look's server authors for it (`PREVIEW_FILE_ENV`):
 * a plugin or a component no page places yet, looked at like a page. A run's reviewers wrote probe pages in their
 * scratch to see one, and five of them said it.
 */

/** Where the page drawing it answers. */
export const ALONE_PATH = `/${PREVIEW_SLUG}`;

/** Each `--with` read as the props or the attributes of one copy; none, one copy as it is declared. */
export const aloneCopies = (element: string, asked: readonly string[] = []): Record<string, unknown>[] => {
  if (asked.length === 0) {
    return [{}];
  }

  return asked.map((text, index) => {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      value = undefined;
    }

    if (!isRecord(value)) {
      throw new RunRefusal(
        'invalid',
        `--with ${String(index + 1)} is not a JSON object: each --with is the props (a component) or the attributes (an element) of one copy of ${element} — --with '{"status":"banana"}', or --with '{}' for one as it is declared`
      );
    }

    return value;
  });
};

/** The file the look's server reads it from, in the task's cache, and what the server is started with to read it. */
export const alonePreview = async (
  cache: string,
  element: string,
  asked: readonly string[] = []
): Promise<{ env: Record<string, string>; copies: number }> => {
  const copies = aloneCopies(element, asked);
  const file = path.join(cache, 'alone.json');
  await fs.mkdir(cache, { recursive: true });
  await fs.writeFile(file, `${JSON.stringify({ element, copies }, null, 2)}\n`);

  return { env: { [PREVIEW_FILE_ENV]: file }, copies: copies.length };
};
