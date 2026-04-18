import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ejs from 'ejs';

import type { SSRTemplateFn, SSRTemplateProps } from '../types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATE_PATH = path.resolve(__dirname, 'views/template.ejs');

export type TemplateParams = SSRTemplateProps & {
  html: string;
  offlineData: string;
};

export const compileTemplate = (): SSRTemplateFn =>
  ejs.compile(fs.readFileSync(DEFAULT_TEMPLATE_PATH, 'utf-8'), { filename: DEFAULT_TEMPLATE_PATH });
