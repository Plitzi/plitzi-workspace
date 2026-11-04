import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The one folder of an app that ships to dist as SOURCE: its browser entry (`view/index.tsx`) and every module
 *  that entry bundles. The server builds it with esbuild at request time, so none of it is in the module graph the
 *  library build compiles — a view-side module that does not travel verbatim is simply missing at runtime, which
 *  the package only finds out when a host asks for the page. Everything else in an app (its definition) compiles
 *  like any other module. */
export const VIEW_DIR = 'view';

/** Does this file ship as source? The build's copy step asks it, and `apps.test.ts` asks it of every real input of
 *  every app's bundle — so a view that grows a sibling module either lives in `view/` or fails the suite, instead
 *  of failing a deployment. Tests stay behind; the page shell travels with the views it renders. */
export const shipsAsSource = (file: string): boolean => {
  if (file.endsWith('.ejs')) {
    return true;
  }

  return path.dirname(file).split(path.sep).includes(VIEW_DIR) && !/\.test\.[^.]+$/.test(file);
};

/**
 * A file this package ships beside one of its modules (`view/`, the page shell): beside the module when it runs from
 * the package — its source or its `dist` — and, when a program bundled the module into its own files, in the package
 * as it is installed, found by its name. `inPackage` is where it is under the package's `dist`.
 */
export const shippedPath = (moduleUrl: string, besideModule: string, inPackage: string): string => {
  const beside = path.resolve(path.dirname(fileURLToPath(moduleUrl)), besideModule);
  if (existsSync(beside)) {
    return beside;
  }

  return path.resolve(path.dirname(fileURLToPath(import.meta.resolve('@plitzi/sdk-mcp'))), inPackage);
};
