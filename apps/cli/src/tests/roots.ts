import path from 'node:path';

/**
 * Where the CLI's tests find what lies outside their own folder — the CLI's package, its source, the workspace — said
 * once: a test that counted `../` from its own folder pointed elsewhere the day it moved.
 */
export const CLI_ROOT = path.resolve(import.meta.dirname, '../..');

export const SRC_ROOT = path.join(CLI_ROOT, 'src');

export const WORKSPACE_ROOT = path.resolve(CLI_ROOT, '../..');
