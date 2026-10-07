/** The three package managers a generated project can be spoken to in. */
export type PackageManager = 'npm' | 'yarn' | 'pnpm';

/** Where the space comes from, and whether there is a server in the picture. The two decisions, and the only two. */
export interface CreateAnswers {
  name: string;
  /** `server` renders on a Node tier (SSR + RSC); `client` renders in the browser with no server at all. */
  mode: 'server' | 'client';
  /** `local` carries the space in the project; `cloud` reads the live one out of Plitzi. */
  source: 'local' | 'cloud';
  /** Cloud only: the self-hosting key (server) or the public render key (client). */
  key: string;
  environment: string;
  /** A published environment's revision to serve, pinned; its latest when left out. */
  revision?: number;
  /**
   * Which package manager the project is written for.
   *
   * Not a third decision — it changes no file's meaning — but it is written into every command the project
   * quotes at somebody, and into the one file Yarn needs to install the way the other two already do.
   */
  packageManager: PackageManager;
  /**
   * What a local space starts as: `welcome` (the default), a tour of the platform with a plugin of the project's own;
   * `blank` — tokens, a layout and one empty page, for a project about to be something specific; or `catalog` — a
   * shop to read and change: a layout, a card component, data in `src/data` (`public/data` with no server), a filtered list and a page per item,
   * a file per part.
   */
  template?: CreateTemplate;
  /**
   * The version of that manager this machine runs, when it could be asked.
   *
   * Only one file depends on it: Yarn refuses a `.yarnrc.yml` naming a setting it does not know, so the release-age
   * exemption is written only for a Yarn that has the age gate at all. Unknown means current.
   */
  managerVersion?: string;
  /**
   * A project made from a space (`plitzi create --from`): its actions are files of their own in `src/actions/` and its
   * connectors in `src/connectors/`, and what is the space's — its pages, actions, functions and `src/main.ts` — is
   * `plitzi space pull`'s to bring up to date.
   */
  fromSpace?: boolean;
  /** Whether the project has a runtime of the space's (`src/runtime/`): `start:dev` restarts on a change to it. */
  runtime?: boolean;
}

export const CREATE_TEMPLATES = ['welcome', 'blank', 'catalog'] as const;

export type CreateTemplate = (typeof CREATE_TEMPLATES)[number];

/** Every file of the generated project, by the path it is written to. */
export type ProjectFiles = Record<string, string>;

/** One element, as somebody described it when it was created: the words the builder and an agent see. */
export interface ElementAnswers {
  /** Its name — `seat-picker` — from which its type and component are derived (see `pluginNames`). */
  name: string;
  /** What the builder calls it, and the label it renders until an attribute says otherwise. */
  title: string;
  /** What it is for, in a sentence: the builder shows it, and an agent reads it to choose the element. */
  description: string;
}

/** What a plugin package is built from. */
export interface PluginAnswers {
  /** The package name. The element it is named after is the first of `elements`, and carries the same name. */
  packageName: string;
  /** Every element the package holds, the one it is named after first. */
  elements: ElementAnswers[];
  /** Who publishes it: the manifest's `owner` and the package's `author`. */
  owner: string;
  packageManager: PackageManager;
  /** As for a project: decides only whether Yarn's age-gate exemption can be written. */
  managerVersion?: string;
  /**
   * Whether the package is written inside a project that already exists.
   *
   * That project already says how it is installed — its `.yarnrc.yml`, its `pnpm-workspace.yaml` — and a second copy
   * in a folder of it is not a setting but a second, conflicting project root. So those files are left to the project.
   */
  inProject: boolean;
}
