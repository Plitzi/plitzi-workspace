/**
 * The server of a project `@plitzi/cli` writes: its `src/main.ts` hands `serveProject` the space, its actions and its
 * options, and the rest — the port, the plugins, the functions, the runtime, the files, the reloads while developing —
 * comes from where the project keeps each part (`@plitzi/sdk-shared/project/paths`). A fix to it arrives with the
 * package, never as a file to upgrade.
 */
export { serveProject } from './modules/project/serveProject';
export type {
  ProjectServerOptions,
  ProjectSpace,
  ServedProject,
  ServeProjectOptions
} from './modules/project/serveProject';
export type { AuthoredDocuments } from './modules/project/watchSpace';
