import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ejs from 'ejs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, 'views/template.ejs');

const compiledTemplate = ejs.compile(fs.readFileSync(TEMPLATE_PATH, 'utf-8'), { filename: TEMPLATE_PATH });

export type TemplateParams = {
  title: string;
  html: string;
  offlineData: string;
  jsPath: string;
  cssPath: string;
  builderJsPath?: string;
  builderCssPath?: string;
  pluginsJsPath?: string;
  react: string;
  reactJsx: string;
  reactDom: string;
  reactDomClient: string;
};

export const renderTemplate = (params: TemplateParams): string => compiledTemplate(params);
