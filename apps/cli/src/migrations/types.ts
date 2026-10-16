/** One file of the project's own source, as a migration reads it. */
export interface SourceFile {
  /** Relative to the project's root. */
  file: string;
  text: string;
}

/** The project a run of the migrations looks at. */
export interface MigrationProject {
  root: string;
  /** The CLI version that last upgraded it (its scaffold record) — none when that was never recorded. */
  lastUpgraded: string | undefined;
}

/** A place a migration names in one file: what is written there, and what to write instead. */
export interface MigrationPlace {
  line: number;
  what: string;
}

/**
 * A change a CLI version made that a project's own source may have to follow: a name renamed, an import the packages no
 * longer answer, a default that flipped. One file per migration in this folder, listed in `MIGRATIONS` by `since`.
 */
export interface Migration {
  /** How the report names it: its file's name. */
  id: string;
  /** The CLI version the change shipped in. */
  since: string;
  /**
   * - `always`: what it finds is broken whenever the project was last upgraded — an import the installed package no
   *   longer answers fails to build — so every project is looked at.
   * - `until-upgraded`: what a project upgraded at or after `since` was told then — a default that flipped — so only a
   *   project the CLI last upgraded before it, or that has no record of it, is looked at.
   */
  scope: 'always' | 'until-upgraded';
  /**
   * Set up for one project: what the migration reads once (what is installed) read here, and the finder for each source
   * file returned.
   */
  start: (project: MigrationProject) => (source: SourceFile) => Promise<MigrationPlace[]>;
  /**
   * The file as it is to be written — only for a change with one right answer, a rename. Without it, what is found is
   * said and never written: the author decides.
   */
  rewrite?: (source: SourceFile) => string;
}

/** What a run reports: a place one migration found, and whether `--write` wrote the change. */
export interface MigrationFinding extends MigrationPlace {
  migration: string;
  since: string;
  file: string;
  written: boolean;
}
