/**
 * A project's server bundled for production: `@plitzi/sdk-server/bundle`, which a project's `npm run build` runs
 * (`.plitzi/build.ts`). Its own entry because it is a build step: a server that only serves never loads it.
 */
export { bundleProject } from './hosts/project/bundle';
export type { BundledProject, BundleProjectOptions } from './hosts/project/bundle';
