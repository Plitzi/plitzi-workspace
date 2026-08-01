import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ejs from 'ejs';

import { bundle } from './bundle';

import type { McpApp, McpViewSettings } from '../../types';

const SHELL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'shell.ejs');

const template = (): ejs.TemplateFunction => ejs.compile(readFileSync(SHELL, 'utf-8'), { filename: SHELL });

// The MCP service builds a server per request, so an un-memoized page would bundle on every call. Two caches
// rather than one: the settings vary the HTML, but the browser bundle they wrap is identical — and building that
// is the expensive half.
const scripts = new Map<string, Promise<string>>();
const pages = new Map<string, Promise<string>>();

const script = (entry: string): Promise<string> => {
  let built = scripts.get(entry);
  if (!built) {
    built = bundle(entry);
    scripts.set(entry, built);
  }

  return built;
};

export const page = (app: McpApp, settings: McpViewSettings): Promise<string> => {
  const key = `${app.uri}|${JSON.stringify(settings)}`;
  let html = pages.get(key);
  if (!html) {
    html = script(app.entry).then(code =>
      template()({
        title: app.title,
        app: code,
        css: (app.styles?.() ?? []).join('\n'),
        settings: JSON.stringify(settings)
      })
    );
    pages.set(key, html);
  }

  return html;
};
