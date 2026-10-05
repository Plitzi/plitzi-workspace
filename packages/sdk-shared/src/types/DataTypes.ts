/**
 * A space's own data, as everything outside the page server sees it — the builder, the CLI, the MCP and the platform
 * that keeps it: JSON files a provider of the space reads on the server (`/data/<file>`), never served. What a project
 * keeps in `src/data/`.
 */

/** One reason the data was not saved, by the file it is about — what an editor marks. */
export type DataProblem = { file: string; message: string };

/** The draft's data: its files, and which copy of them this is. */
export type DataDraft = {
  /** `{ "products.json": "[…]", "shop/hours.json": "{…}" }`. */
  files: Record<string, string>;
  /** Hand it back as `base` when saving: data that moved on since is refused rather than overwritten. */
  version: string;
};

/**
 * Why nothing was saved: `version`, the data moved on since the copy this save started from; `storage`, the space has no
 * private bucket to keep it in (the error says how to add one); `size`, it weighs more than a render reads.
 */
export type DataRefusal = { status: number; error: string; limit: 'version' | 'storage' | 'size' };

export type DataSaveResult =
  { ok: true; version: string } | { ok: false; problems: DataProblem[] } | { ok: false; refusal: DataRefusal };
