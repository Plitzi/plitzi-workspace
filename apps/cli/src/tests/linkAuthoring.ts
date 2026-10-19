import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * What every project and plugin package has installed that a plugin's declaration imports — `@plitzi/sdk-authoring`,
 * for its `./plugin` — linked into a folder made for a test, so the declaration resolves there as it does in a real
 * one, and nothing else does: TypeScript, React and the SDK stay as missing as the test made them.
 */
export const linkAuthoring = async (dir: string): Promise<void> => {
  await fs.mkdir(path.join(dir, 'node_modules/@plitzi'), { recursive: true });
  await fs.symlink(
    path.resolve(import.meta.dirname, '../../../../packages/sdk-authoring'),
    path.join(dir, 'node_modules/@plitzi/sdk-authoring'),
    'dir'
  );
};
