/**
 * The project's layout held to what reads it: every folder the server builds, runs or serves from where the CLI puts
 * it, each with the file it starts at. One check, said the same by the three that read the project — its server at
 * boot (`serveProject`), its authoring (`projectAuthoring`: `npm run author` and the CLI's checks) and `plitzi doctor`,
 * which makes the fixes that have one reading (`autofix`). Pure file system: what a file holds is never imported.
 *
 * An `error` is what keeps a part of the project from running — a plugin the server cannot build, code in a folder
 * nothing reads, settings Node never loads — and stops the server and the authoring; a `warning` works, and should not
 * stay.
 */

export { PROJECT_LAYOUT_CODES } from './codes';
export type { LayoutAutofix, LayoutCode, LayoutFinding, LayoutLevel, ProjectLayoutOptions } from './codes';
export { checkPluginFolder, elementEntry, pluginEntry, pluginTypeOf } from './plugins';
export { readVendorPlugin } from './vendor';
export type { VendorPlugin } from './vendor';
export { ProjectLayoutError, assertProjectLayout, checkProjectLayout, layoutFindingText } from './check';
