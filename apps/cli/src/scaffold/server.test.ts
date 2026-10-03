/* eslint-disable quotes -- the generated code quotes its own strings, and reads best in the other quotes */
import { describe, expect, it } from 'vitest';

import { gitignore } from './project';
import { serverFiles } from './server';
import { visualFiles } from './visual';

import type { CreateAnswers } from './types';

const answers = (over: Partial<CreateAnswers> = {}): CreateAnswers => ({
  name: 'catalog',
  mode: 'server',
  source: 'local',
  key: '',
  environment: 'main',
  packageManager: 'npm',
  ...over
});

describe('the server a project starts', () => {
  it('serves public/ — the data with no backend — with nothing to add to main.ts', () => {
    const files = serverFiles(answers());

    expect(files['src/main.ts']).toContain("publicDir: path.join(PROJECT_ROOT, 'public')");
    expect(files['public/data/.gitkeep']).toBe('');
  });

  it('starts beside whatever holds 8080 while developing, and says where it went', () => {
    const main = serverFiles(answers())['src/main.ts'];

    expect(main).toContain('await freePort(8080, HOST)');
    expect(main).toContain("'.plitzi/dev-server.json'");
    expect(gitignore(answers())).toContain('.plitzi\n');
  });

  it('answers /health with the space it serves, and a cloud one with the project’s name', () => {
    expect(serverFiles(answers())['src/main.ts']).toContain('const SERVER_NAME = schema.definition.permanentUrl;');
    expect(serverFiles(answers({ source: 'cloud' }))['src/main.ts']).toContain('const SERVER_NAME = "catalog";');
  });
});

describe('the scripts that look at it', () => {
  it('find the port the server took', () => {
    expect(visualFiles(answers())['playwright.config.ts']).toContain('process.env.PORT ?? recorded().port ?? 8080');
  });

  // An agent reads everything a command prints: a line per request is thousands of tokens of "200 ok".
  it('prints what went wrong, and every request only when asked', () => {
    for (const source of ['local', 'cloud'] as const) {
      expect(serverFiles(answers({ source }))['src/main.ts']).toContain(
        "logLevel: process.argv.includes('--verbose') ? 'info' : 'warn',"
      );
    }
  });
});
