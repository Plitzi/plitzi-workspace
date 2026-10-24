import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Every test file on a config folder of its own: nothing a test does reaches the person's own — their account's
 * session, this machine's pace (`runs/history.ts`), which a run ending in a test would otherwise write to. A test that
 * names one itself (`XDG_CONFIG_HOME`) is left with it.
 */
process.env.XDG_CONFIG_HOME = mkdtempSync(path.join(os.tmpdir(), 'plitzi-config-'));
