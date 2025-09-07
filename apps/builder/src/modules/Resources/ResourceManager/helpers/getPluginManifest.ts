import JSZip from 'jszip';

import type { PluginManifest } from '@plitzi/sdk-shared';

const readJsons = async (file: File, filePath: string) => {
  try {
    // this part does the same thing, but with different syntax
    const zip = await JSZip.loadAsync(file);
    const zipFile = zip.file(filePath);
    if (!zipFile) {
      return undefined;
    }

    const jsonData = await zipFile.async('string');
    return JSON.parse(jsonData) as PluginManifest;
  } catch (e) {
    console.error(e); // error handling
  }

  return undefined;
};

const getPluginManifest = async (file: File) => {
  const manifest = await readJsons(file, 'plugin-manifest.json');
  if (!manifest) {
    return undefined;
  }

  return manifest;
};

export default getPluginManifest;
