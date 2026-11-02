import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { pluginStylesheets } from './node';

let root: string | undefined;

afterEach(() => {
  if (root !== undefined) {
    rmSync(root, { recursive: true, force: true });
  }
});

const write = (file: string, text: string): void => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
};

// A run's 26 tokens a package stylesheet read were "unused", and its finish refused on the suggestion.
describe('the stylesheets a project’s plugins load', () => {
  it('are their own .css and what their code imports — a package’s by its style field, a shared one by its path', () => {
    root = mkdtempSync(path.join(os.tmpdir(), 'plugin-css-'));
    const plugins = path.join(root, 'src/plugins');
    write(path.join(plugins, 'VzButton/VzButton.css'), '.vz-own { color: var(--vz-own); }');
    write(
      path.join(plugins, 'VzButton/VzButton.tsx'),
      "import '@fake/vizzele-css';\nimport '../../styles/bridge.css';\nimport { thing } from './thing';\nexport const VzButton = thing;\n"
    );
    write(path.join(root, 'src/styles/bridge.css'), '.vz-bridge { color: var(--vz-bridge); }');
    write(
      path.join(root, 'node_modules/@fake/vizzele-css/package.json'),
      JSON.stringify({ name: '@fake/vizzele-css', style: 'dist/vizzele.css', main: 'index.js' })
    );
    write(path.join(root, 'node_modules/@fake/vizzele-css/index.js'), 'module.exports = {};');
    write(path.join(root, 'node_modules/@fake/vizzele-css/dist/vizzele.css'), '.vz { color: var(--vz-text-muted); }');

    const sheets = pluginStylesheets(plugins).join('\n');

    expect(sheets).toContain('var(--vz-own)');
    expect(sheets).toContain('var(--vz-bridge)');
    expect(sheets).toContain('var(--vz-text-muted)');
  });
});
