export type LayoutLevel = 'error' | 'warning';

/** Every finding of the layout check, by its code: how much it matters, and what it means in a line. */
export const PROJECT_LAYOUT_CODES = {
  'plugin-entry-missing': {
    level: 'error',
    means: 'a folder of src/plugins/ with no index.ts (or index.tsx), which the server builds the plugin from'
  },
  'plugin-entry-ambiguous': {
    level: 'error',
    means: 'a folder of src/plugins/ with both index.ts and index.tsx: a plugin starts at one'
  },
  'entry-not-typescript': {
    level: 'error',
    means:
      'an entry the server builds or runs written as JavaScript (index.js, .jsx, .mjs, .cjs): the project is TypeScript'
  },
  'plugin-name-invalid': {
    level: 'error',
    means: 'a folder of src/plugins/ whose name cannot be an element type: a letter, then letters and digits'
  },
  'plugin-type-taken': {
    level: 'error',
    means: 'two folders of src/plugins/ that are the same element type (StoryEditor and storyEditor)'
  },
  'plugin-shadowed': {
    level: 'error',
    means: 'a plugin both in src/plugins/ and, as it was built, in vendor/plugins/: the built one runs'
  },
  'plugin-functions-entry-missing': {
    level: 'error',
    means: 'a plugin’s functions/ with code and no index.ts, which its server half is built from'
  },
  'functions-entry-missing': {
    level: 'error',
    means: 'src/functions/ with code and no index.ts, which the project’s functions are built from'
  },
  'runtime-entry-missing': {
    level: 'error',
    means: 'src/runtime/ with code and no index.ts, which the space’s runtime starts at'
  },
  'space-entry-missing': {
    level: 'error',
    means: 'a space written in the project with no src/space/index.ts, which the server and npm run author import'
  },
  'space-default-export': {
    level: 'error',
    means: 'src/space/index.ts exporting the space by default, where it is imported by name: `space`'
  },
  'vendor-manifest-missing': {
    level: 'error',
    means: 'a built plugin (vendor/plugins/<type>/) with no plugin-manifest.json'
  },
  'vendor-manifest-invalid': {
    level: 'error',
    means: 'a built plugin’s plugin-manifest.json that is not a manifest'
  },
  'vendor-script-missing': {
    level: 'error',
    means: 'a built plugin’s manifest naming no script to run, or one that is not there'
  },
  'env-in-src': {
    level: 'error',
    means: '.env inside src/: Node reads the project’s settings from the .env at its root'
  },
  'folder-misplaced': {
    level: 'error',
    means: 'code in a folder named like one the server reads (src/plugin/, plugins/ at the root): nothing reads it'
  },
  'folder-near-miss': {
    level: 'warning',
    means: 'a folder named like one the server reads (src/Data/, src/runtimes/), which nothing reads'
  },
  'plugin-declaration-missing': {
    level: 'warning',
    means: 'a plugin folder with no declaration.ts: the space’s use of the plugin is held to nothing'
  },
  'plugin-file-loose': {
    level: 'warning',
    means: 'a file directly in src/plugins/, where every plugin is a folder'
  },
  'data-not-json': {
    level: 'warning',
    means: 'a file of src/data/ that is not JSON, which no provider and no ctx.data reads'
  },
  'env-missing': {
    level: 'warning',
    means: 'no .env at the project’s root: none of its settings is set'
  },
  'env-example-missing': {
    level: 'warning',
    means: 'no .env.example: a clone does not know what .env must hold'
  },
  'public-data': {
    level: 'warning',
    means: 'JSON in public/data/ of a project with a server: served to anyone who asks'
  },
  'public-secret-file': {
    level: 'warning',
    means: 'a file in public/ named like a secret (.env, a key, a dump): served to anyone who asks'
  }
} as const satisfies Record<string, { level: LayoutLevel; means: string }>;

export type LayoutCode = keyof typeof PROJECT_LAYOUT_CODES;

/**
 * The fix of a finding that has one reading, for `plitzi doctor --fix` to make. Paths are relative to the root, a
 * folder's ending in `/`: a `move` of a folder takes everything under it, into a folder that may already be there.
 */
export type LayoutAutofix =
  | { action: 'move'; from: string; to: string }
  | { action: 'copy'; from: string; to: string }
  | { action: 'write'; file: string; contents: string };

/** One thing out of place: where (`file`, relative to the root), what is wrong, and what to do — the command, if any. */
export interface LayoutFinding {
  level: LayoutLevel;
  code: LayoutCode;
  file: string;
  message: string;
  fix: string;
  autofix?: LayoutAutofix;
}

export interface ProjectLayoutOptions {
  /** Whether the project runs a server of its own — told by its `@plitzi/sdk-server` dependency when left out. */
  mode?: 'server' | 'client';
  /** Where its space is: written in it (`src/space/`), or kept on Plitzi — told by its files when left out. */
  space?: 'local' | 'cloud';
}

export const finding = (
  code: LayoutCode,
  file: string,
  message: string,
  fix: string,
  autofix?: LayoutAutofix
): LayoutFinding => ({
  level: PROJECT_LAYOUT_CODES[code].level,
  code,
  file,
  message,
  fix,
  ...(autofix ? { autofix } : {})
});
