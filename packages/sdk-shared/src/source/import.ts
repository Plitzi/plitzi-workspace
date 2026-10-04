import type { Schema, Style } from '../types';

/**
 * A project's space put back on Plitzi as the space's draft (docs/en/projects-from-spaces.md): what `plitzi push` sends
 * to `PUT /spaces/:spaceId/import`, and what it is answered. The way back of `SpaceExport` — one shape for both ends.
 */

export const SPACE_IMPORT_FORMAT = 1;

export type SpaceImport = {
  format: typeof SPACE_IMPORT_FORMAT;
  /** The space as the project authors it: the two documents the draft is made of, replaced whole. */
  documents: { schema: Schema; style: Style };
  /**
   * Every server action the project keeps, and every connector: the space's become exactly these. Left out, the project
   * keeps none of its own, and the space's are left as they are.
   */
  actions?: { identifier: string; name: string; document: unknown }[];
  connectors?: { identifier: string; name: string; manifest: unknown }[];
  /**
   * The draft the project was last given or last pushed (`SpaceExport.draft`): the push is refused when the space's has
   * moved on since. `null` for a project that never had one — refused unless the space is still as it was created.
   */
  base: string | null;
  /** Replace the draft whatever it holds now. */
  force: boolean;
};

/** Why a push was not taken, before anything was checked: the draft is not the one the project knows. */
export type SpaceImportRefusalCode = 'DRAFT_MOVED' | 'DRAFT_NOT_EMPTY';

export type SpaceImportResult =
  /** Taken: `draft` is what the project knows from now on; `changed` false when it already was the space's draft. */
  | { ok: true; changed: boolean; draft: string }
  | { ok: false; refusal: { code: SpaceImportRefusalCode; error: string } }
  /** Not taken: what is wrong with what was sent, each problem where it is. */
  | { ok: false; problems: string[] };
