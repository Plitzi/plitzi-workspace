import fs from 'fs';
import path from 'path';

// Path to the compiled library folder
const DIST = path.resolve('./dist/src');

// Helper function to create a Node-compatible export path
const makeExportPath = file => `./${path.relative(process.cwd(), file).replace(/\\/g, '/')}`;

/**
 * Recursively scans the dist folder and generates exports
 *
 * @param {string} dir - Current directory to scan
 * @param {string} prefix - Prefix for the export key
 * @returns {object} Exports object
 */
function generateExports(dir, prefix = '.') {
  const exportsObj = {};
  if (!fs.existsSync(dir)) {
    return exportsObj;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    // Key in exports, always starting with './'
    const key =
      prefix === '.' ? `./${entry.name.replace(/\.mjs$/, '')}` : `${prefix}/${entry.name.replace(/\.mjs$/, '')}`;

    if (entry.isDirectory()) {
      // For folders, check if index.mjs / index.cjs / index.d.ts exist
      const indexFiles = {
        types: path.join(entryPath, 'index.d.ts'),
        import: path.join(entryPath, 'index.mjs'),
        require: path.join(entryPath, 'index.cjs')
      };

      const exportEntry = {};
      // Only add paths that exist
      for (const [type, filePath] of Object.entries(indexFiles)) {
        if (fs.existsSync(filePath)) {
          exportEntry[type] = makeExportPath(filePath);
        }
      }

      if (Object.keys(exportEntry).length && (exportEntry.import || exportEntry.require) && exportEntry.types) {
        exportsObj[key] = exportEntry;
      }

      // Recursively scan subfolders
      Object.assign(exportsObj, generateExports(entryPath, key));
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      // For single .mjs files
      const files = {
        types: entryPath.replace(/\.mjs$/, '.d.ts'),
        import: entryPath,
        require: entryPath.replace(/\.mjs$/, '.cjs')
      };
      const exportEntry = {};
      for (const [type, filePath] of Object.entries(files)) {
        if (fs.existsSync(filePath)) {
          exportEntry[type] = makeExportPath(filePath);
        }
      }

      if (Object.keys(exportEntry).length) {
        exportsObj[key] = exportEntry;
      }
    }
  }

  return exportsObj;
}

// Handle the main entry of the library (dist/index.*)
const mainIndex = {
  types: path.join(DIST, 'index.d.ts'),
  import: path.join(DIST, 'index.mjs'),
  require: path.join(DIST, 'index.cjs')
};
const mainExports = {};
for (const [type, file] of Object.entries(mainIndex)) {
  if (fs.existsSync(file)) {
    mainExports['.'] = { ...mainExports['.'], [type]: makeExportPath(file) };
  }
}

// Read current package.json
const pkgPath = path.resolve('./package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

// Merge main entry and recursive exports
pkg.exports = { ...mainExports, ...generateExports(DIST) };

// Write updated package.json
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log('✅ package.json updated with automatic exports for the entire library');
