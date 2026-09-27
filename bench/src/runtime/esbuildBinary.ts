import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { run } from './process';

const readVersion = (packageJsonPath: string): string => {
  const parsed: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed) || typeof parsed.version !== 'string') {
    throw new Error(`${packageJsonPath} names no version`);
  }

  return parsed.version;
};

/**
 * The Linux build of the esbuild the workspace installed, for a container that mounts the host's `node_modules`.
 *
 * tsx and sdk-server's plugin compiler both drive esbuild, whose binary is platform-specific: the one installed on a
 * macOS host cannot run in the container. esbuild honours `ESBUILD_BINARY_PATH`, so the matching Linux binary is
 * downloaded once into the bench cache instead of installing the workspace a second time for another platform.
 */
export const linuxEsbuildBinary = async (workspaceRoot: string, arch: 'arm64' | 'x64'): Promise<string> => {
  const version = readVersion(path.join(workspaceRoot, 'node_modules/esbuild/package.json'));
  const dir = path.join(workspaceRoot, 'bench/.cache', `esbuild-linux-${arch}-${version}`);
  const binary = path.join(dir, 'package/bin/esbuild');
  if (existsSync(binary)) {
    return binary;
  }

  const url = `https://registry.npmjs.org/@esbuild/linux-${arch}/-/linux-${arch}-${version}.tgz`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download the Linux esbuild ${version} (${url}): HTTP ${response.status}`);
  }

  mkdirSync(dir, { recursive: true });
  const tarball = path.join(dir, 'package.tgz');
  writeFileSync(tarball, Buffer.from(await response.arrayBuffer()));
  await run('tar', ['-xzf', tarball, '-C', dir]);

  return binary;
};
