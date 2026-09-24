/* eslint-disable quotes */
import { describe, expect, it } from 'vitest';

import { pluginNameProblem, pluginNames, scaffoldElement, scaffoldPlugin } from '.';
import { htmlText, tsString } from './quote';

import type { PluginAnswers } from '../types';

/**
 * A plugin package is a promise about the day it is published: the element a space names is the one the manifest
 * describes, the bundle leaves the page's React alone, and a build the builder takes comes out of `zip`. What is
 * asserted is that shape — the parts that fail silently when they drift.
 */

const answers = (over: Partial<PluginAnswers> = {}): PluginAnswers => ({
  packageName: 'plitzi-plugin-seat-picker',
  title: 'Seat Picker',
  description: 'Picks a seat.',
  owner: 'Acme',
  packageManager: 'npm',
  inProject: false,
  ...over
});

describe('the names of a plugin', () => {
  it('derives every name from the package name, with the scope and the prefix off', () => {
    expect(pluginNames('@acme/plitzi-plugin-seat-picker')).toEqual({
      packageName: '@acme/plitzi-plugin-seat-picker',
      base: 'seat-picker',
      type: 'seatPicker',
      component: 'SeatPicker',
      title: 'Seat Picker'
    });
    expect(pluginNames('chart2')).toMatchObject({ type: 'chart2', component: 'Chart2' });
  });

  it('refuses a name npm would, and one that makes no component, saying why', () => {
    expect(pluginNameProblem('Seat Picker')).toContain('not a package name npm accepts');
    expect(pluginNameProblem('plitzi-plugin-2d')).toContain('starting with a letter');
    expect(pluginNameProblem('seat--picker')).toContain('single dashes');
    expect(pluginNameProblem('@acme/seat-picker')).toBeUndefined();
  });
});

describe('the plugin package', () => {
  it('is an element, a build, a preview and a test — and the element is shaped like the SDK’s own', () => {
    const files = scaffoldPlugin(answers());

    for (const file of [
      'src/SeatPicker/SeatPicker.tsx',
      'src/SeatPicker/declaration.ts',
      'src/SeatPicker/Settings.tsx',
      'src/SeatPicker/index.ts',
      'src/declarations.ts',
      'src/index.ts',
      'vite.config.ts',
      'build/manifest.ts',
      'build/zip.ts',
      'preview/main.ts',
      'preview/space.ts',
      'visual/plugin.spec.ts',
      'README.md',
      'AGENTS.md'
    ]) {
      expect(files[file], file).toBeDefined();
    }

    expect(files['src/SeatPicker/index.ts']).toContain(
      'Object.assign(BaseSeatPicker, declaration, { pluginSettings: Settings })'
    );
  });

  it('declares the element once, and the component registers what it declares', () => {
    const files = scaffoldPlugin(answers());
    const declaration = files['src/SeatPicker/declaration.ts'];
    const component = files['src/SeatPicker/SeatPicker.tsx'];

    expect(declaration).toContain("type: 'seatPicker'");
    expect(declaration).toContain('satisfies PluginDeclaration<SeatPickerAttributes>');
    // Data only: the build reads it with no React to load.
    expect(declaration).not.toMatch(/^import (?!type)/m);
    expect(component).toContain('...declaration.triggers.onCount');
    expect(component).toContain('...declaration.callbacks.reset');
  });

  it('writes the manifest from the declarations and the files the build made', () => {
    const manifest = scaffoldPlugin(answers())['build/manifest.ts'];

    expect(manifest).toContain("runnerImport<DeclarationsModule>(path.join(root, 'src/declarations.ts')");
    expect(manifest).toContain('root: main.type');
    expect(manifest).toContain('verified: false');
    expect(manifest).toContain("createHash('sha384')");
  });

  it('builds one file that imports the page’s React and SDK rather than carrying its own', () => {
    const config = scaffoldPlugin(answers())['vite.config.ts'];

    expect(config).toContain(String.raw`/^(react|react-dom|@plitzi\/plitzi-sdk)(\/.*)?$/`);
    expect(config).toContain('codeSplitting: false');
    expect(config).toContain("fileName: () => 'seat-picker.mjs'");
  });

  it('makes React and the SDK peers, and names the scripts the README quotes', () => {
    const pkg = JSON.parse(scaffoldPlugin(answers())['package.json']) as {
      name: string;
      author?: string;
      peerDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };

    expect(pkg.name).toBe('plitzi-plugin-seat-picker');
    expect(pkg.author).toBe('Acme');
    expect(Object.keys(pkg.peerDependencies).sort()).toEqual(['@plitzi/plitzi-sdk', 'react', 'react-dom']);
    expect(Object.keys(pkg.scripts)).toEqual(
      expect.arrayContaining(['start', 'build', 'zip', 'typecheck', 'lint', 'format', 'visual'])
    );
    // `pack` is npm's, Yarn's and pnpm's own command: a script by that name would never be the one that runs.
    expect(pkg.scripts.pack).toBeUndefined();
  });

  it('leaves how to install to a project it is written inside', () => {
    expect(scaffoldPlugin(answers({ packageManager: 'yarn' }))['.yarnrc.yml']).toBeDefined();
    expect(scaffoldPlugin(answers({ packageManager: 'yarn', inProject: true }))['.yarnrc.yml']).toBeUndefined();
    expect(scaffoldPlugin(answers({ packageManager: 'pnpm', inProject: true }))['pnpm-workspace.yaml']).toBeUndefined();
  });

  it('writes what somebody typed as source that still parses', () => {
    const files = scaffoldPlugin(answers({ title: "Carlos's picker", description: 'Say "hi" \\ bye' }));

    expect(files['src/SeatPicker/declaration.ts']).toContain('label: "Carlos\'s picker"');
    expect(files['src/SeatPicker/declaration.ts']).toContain('description: \'Say "hi" \\\\ bye\'');
    expect(files['index.html']).toContain("<title>Carlos's picker — preview</title>");
  });
});

describe('an element added to a project', () => {
  it('is the same four files, by their path inside its own folder', () => {
    const files = scaffoldElement('seat-picker', { title: 'Seat Picker', description: '', owner: '' });

    expect(Object.keys(files).sort()).toEqual(['SeatPicker.tsx', 'Settings.tsx', 'declaration.ts', 'index.ts']);
    expect(files['declaration.ts']).toContain("type: 'seatPicker'");
  });
});

describe('free text in generated source', () => {
  it('is quoted the way Prettier quotes it, and escaped where it has to be', () => {
    expect(tsString('plain')).toBe("'plain'");
    expect(tsString("it's")).toBe('"it\'s"');
    expect(tsString('a\\b\nc')).toBe(String.raw`'a\\b\nc'`);
    expect(htmlText('<b>&</b>')).toBe('&lt;b&gt;&amp;&lt;/b&gt;');
  });
});
