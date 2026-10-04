import type { SpaceVersionContents } from '../types';

/**
 * A space taken back out as a project (docs/en/projects-from-spaces.md): everything it is made of that Plitzi keeps, as
 * `GET /spaces/:spaceId/export` answers it and `plitzi create --from` writes it. One shape for both ends.
 */

export const SPACE_EXPORT_FORMAT = 1;

/** A file the project downloads once and serves itself: where it is on the space's CDN, and where it goes. */
export type SpaceExportFile = {
  /** Its address on the space's CDN, today. */
  url: string;
  /** Where it goes in the project, relative to the folder it is served from: `assets/85a7_world.json`. */
  path: string;
};

/** A path the merge of the source snapshots met more than once, with different content. */
export type SpaceExportConflict = {
  path: string;
  /** The artifact whose copy was kept: the newest snapshot holding the path. */
  kept: string;
  /** The others that held a different copy. */
  others: string[];
};

export type SpaceExport = {
  format: typeof SPACE_EXPORT_FORMAT;
  space: { id: number; name: string; permanentUrl: string };
  /** The version taken out: the draft (`main`, revision 0), or a snapshot an environment holds. */
  version: Pick<SpaceVersionContents, 'environment' | 'revision' | 'snapshot'>;
  /**
   * Which state of the draft's documents this is — its schema, style, actions and connectors — what `plitzi push`
   * checks the space's draft has not moved on from. `null` for a snapshot, which no push writes.
   */
  draft: string | null;
  /** The space as authoring code, by path (`index.ts`, a file per page): none for a project that reads it from Plitzi. */
  authoring: { exportName: string; files: Record<string, string> } | null;
  /**
   * The server-side documents, as they are kept: a flow and a connector name steps and credentials. Whether an action
   * is on is its trigger steps', so nothing beside the document says it.
   */
  actions: { identifier: string; name: string; document: unknown }[];
  connectors: { identifier: string; name: string; manifest: unknown }[];
  /**
   * The space's functions, by path in `functions/`, and the version of them this is — what `plitzi functions push`
   * checks the space's copy has not moved on from.
   */
  functions: { version: string; files: Record<string, string> };
  /**
   * The source its plugins and runtime were built from, merged: every file by its path in the project (bytes in
   * base64), the packages they need, and where each build starts.
   */
  source: {
    files: Record<string, string>;
    dependencies: Record<string, string>;
    runtime: { entries: string[] } | null;
    plugins: { type: string; entries: string[] }[];
  };
  /** What there is no source of: kept built, so the project runs it as it is and cannot change it. */
  builtOnly: {
    plugins: { type: string; files: SpaceExportFile[] }[];
    /** The packed runtime, in base64 — what `@plitzi/sdk-server/runtime` loads. */
    runtime: string | null;
  };
  /** The space's files on its CDN — pictures, fonts, data — for the project to serve itself. */
  assets: SpaceExportFile[];
  /** Names the project is given values for: never the values, which stay on the platform. */
  variables: string[];
  credentials: { identifier: string; name: string; provider: string }[];
  /**
   * The roles the space declares for its visitors (`settings.visitorRoles`), by name. Who holds them stays on Plitzi:
   * they are people's addresses, and a server of its own signs people in itself.
   */
  visitorRoles: string[];
  report: {
    conflicts: SpaceExportConflict[];
    /** Packages two snapshots ask for at different ranges: the newest's is the one written. */
    rangeConflicts: { name: string; kept: string; others: string[] }[];
    /** What the authoring export repaired on the way, in words. */
    corrections: string[];
  };
};
