import path from 'node:path';

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
