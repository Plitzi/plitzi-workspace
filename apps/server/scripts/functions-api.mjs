import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';

/**
 * The contract a space's functions are written against, as ONE declaration file: `dist/functions-api.d.ts`.
 *
 * What an editor needs to type a space's code — the builder's TypeScript worker above all — without the rest of this
 * package or `@plitzi/sdk-shared`: the contract's own declarations, rolled up with every type they reach inlined. Made
 * from the `.d.ts` the build just wrote, so it is never written twice and never out of step with the contract.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = ExtractorConfig.prepare({
  configObject: {
    projectFolder: root,
    mainEntryPointFilePath: path.join(root, 'dist/modules/functions/contract.d.ts'),
    bundledPackages: ['@plitzi/sdk-shared'],
    compiler: {
      overrideTsconfig: {
        compilerOptions: {
          skipLibCheck: true,
          moduleResolution: 'bundler',
          module: 'esnext',
          target: 'es2022',
          lib: ['es2023', 'dom'],
          types: []
        }
      }
    },
    apiReport: { enabled: false },
    docModel: { enabled: false },
    tsdocMetadata: { enabled: false },
    dtsRollup: { enabled: true, untrimmedFilePath: path.join(root, 'dist/functions-api.d.ts') },
    messages: {
      extractorMessageReporting: { default: { logLevel: 'none' } },
      compilerMessageReporting: { default: { logLevel: 'none' } },
      tsdocMessageReporting: { default: { logLevel: 'none' } }
    }
  },
  configObjectFullPath: path.join(root, 'api-extractor.json'),
  packageJsonFullPath: path.join(root, 'package.json')
});
const result = Extractor.invoke(config, { localBuild: true });

if (!result.succeeded) {
  console.error('The functions API declarations could not be rolled up');
  process.exit(1);
}

console.log('Rolled up the functions API into dist/functions-api.d.ts');
