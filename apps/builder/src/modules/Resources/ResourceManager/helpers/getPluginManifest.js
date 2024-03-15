// Packages
import JSZip from 'jszip';

const readJsons = async (file, filePath) => {
  try {
    // this part does the same thing, but with different syntax
    const zip = await JSZip.loadAsync(file);
    const zipFile = zip.file(filePath);
    if (!zipFile) {
      return undefined;
    }

    const jsonData = await zipFile.async('string');
    return JSON.parse(jsonData);
  } catch (e) {
    console.error(e); // error handling
  }

  return undefined;
};

const getPluginManifest = async file => {
  const manifest = await readJsons(file, 'plugin-manifest.json');
  if (!manifest) {
    return undefined;
  }

  return manifest;
};

export default getPluginManifest;
