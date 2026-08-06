import { createRequire } from 'node:module';

// Views resolve @plitzi/plitzi-sdk and its stylesheet through this; createRequire because the module is ESM.
export const require = createRequire(import.meta.url);
