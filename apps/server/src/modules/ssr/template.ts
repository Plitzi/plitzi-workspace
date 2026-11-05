import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ejs from 'ejs';

import type { SSRTemplateFn } from '../../types';

/**
 * Beside this module when it runs from this package: in the source, and in the build, where it is a chunk of its own
 * with `views` copied beside it (`vite.config.ts`, `template` and `copyViews`) — the scripts there minified. A program
 * that bundled this package into its own files moved the module and left the files: they are found in the package as
 * it is installed, through its own name.
 */
const viewsDir = (): string => {
  const beside = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'views');
  if (fs.existsSync(path.join(beside, 'template.ejs'))) {
    return beside;
  }

  const installed = path.resolve(
    path.dirname(fileURLToPath(import.meta.resolve('@plitzi/sdk-server'))),
    'chunks/views'
  );
  if (!fs.existsSync(path.join(installed, 'template.ejs'))) {
    throw new Error(`The page template is neither beside ${beside} nor in the installed package (${installed})`);
  }

  return installed;
};

/** Where the template takes a script of `views/inline/`: `<%- inline('name.js') %>`, on a line of its own. */
const INLINE = /^<%- inline\('([\w.-]+\.js)'\) %>$/gmu;

/**
 * The template with its scripts of `views/inline/` written into it, once, before it is compiled: a page carries them
 * as it is parsed, and every page carries them. Kept apart so the build minifies them — in the source they are readable
 * and commented, and the template's own comments never reach a page. A script that is not there, or that holds a
 * template tag of its own, stops the server at boot rather than leaving a page without it.
 */
export const templateSource = (views = viewsDir()): string => {
  const source = fs.readFileSync(path.join(views, 'template.ejs'), 'utf-8').replace(INLINE, (_, name: string) => {
    const file = path.join(views, 'inline', name);
    if (!fs.existsSync(file)) {
      throw new Error(`template.ejs inlines views/inline/${name}, which is not there`);
    }

    const script = fs.readFileSync(file, 'utf-8').trim();
    if (script.includes('<%') || script.includes('</script')) {
      throw new Error(
        `views/inline/${name} holds "<%" or "</script", which would end what the template writes it into`
      );
    }

    return script;
  });
  // One written otherwise (indented, another quote) would be left for the render to call, and fail every page.
  if (source.includes('<%- inline(')) {
    throw new Error(
      'template.ejs has an inline(…) this server does not write in: put it on a line of its own, as the others'
    );
  }

  return source;
};

export const compileTemplate = (): SSRTemplateFn => {
  const views = viewsDir();

  return ejs.compile(templateSource(views), { filename: path.join(views, 'template.ejs') });
};
