import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

import { startBrowser } from '../../browser';
import { fail } from '../shared/terminal';

/** Which browser the CLI opens pages in now — the first of `BROWSERS` that starts — or why none does. */
export const browserInUse = async (): Promise<{ said: string } | { problem: string }> => {
  const started = await startBrowser();
  if ('problem' in started) {
    return started;
  }

  await started.browser.close();

  return { said: started.said };
};

/** `plitzi browser`: which browser the CLI's page commands open pages in, or the way to have one. */
export const browserStatus = async (options: { json?: boolean }): Promise<void> => {
  const inUse = await browserInUse();
  if (options.json) {
    console.log(JSON.stringify(inUse));
    if ('problem' in inUse) {
      process.exitCode = 1;
    }

    return;
  }

  if ('problem' in inUse) {
    fail(inUse.problem);

    return;
  }

  console.log(`Pages open in ${inUse.said}.`);
};

/**
 * `plitzi browser install`: Chromium for the CLI's driver, downloaded once into Playwright's shared cache — the browser
 * the page commands try first, the driver's own version. Playwright's installer says its progress itself.
 */
export const browserInstall = async (): Promise<void> => {
  const manifest = createRequire(import.meta.url).resolve('playwright-core/package.json');
  const code = await new Promise<number>(resolve => {
    const child = spawn(process.execPath, [path.join(path.dirname(manifest), 'cli.js'), 'install', 'chromium'], {
      stdio: 'inherit'
    });
    child.on('error', error => {
      console.error(error.message);
      resolve(1);
    });
    child.on('exit', exit => resolve(exit ?? 1));
  });
  if (code !== 0) {
    fail(`Chromium was not downloaded (the installer exited with ${String(code)}): try again, or install Chrome`);

    return;
  }

  const inUse = await browserInUse();
  if ('problem' in inUse) {
    fail(inUse.problem);

    return;
  }

  console.log(`Downloaded. Pages open in ${inUse.said}.`);
};
