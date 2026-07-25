import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ejs from 'ejs';

import { bundle } from './bundle';

import type { McpApp } from '../../types';

const SHELL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'shell.ejs');

const template = (): ejs.TemplateFunction => ejs.compile(readFileSync(SHELL, 'utf-8'), { filename: SHELL });

// The MCP service builds a server per request, so an un-memoized page would bundle on every call.
const pages = new Map<string, Promise<string>>();

export const page = (app: McpApp): Promise<string> => {
  let html = pages.get(app.uri);
  if (!html) {
    html = bundle(app.entry).then(script =>
      template()({
        title: app.title,
        app: script,
        css: (app.styles?.() ?? []).map(file => readFileSync(file, 'utf-8')).join('\n')
      })
    );
    pages.set(app.uri, html);
  }

  return html;
};
