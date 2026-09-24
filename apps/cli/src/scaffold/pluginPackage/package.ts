import { managerPackageFields } from '../packageManager';
import { REACT_VERSION, SDK_VERSION, SHARED_DEV_DEPENDENCIES, VITE_VERSION } from '../project';

import type { PluginNames } from './names';
import type { PluginAnswers, ProjectFiles } from '../types';

/**
 * The package itself: what it installs, what it publishes and how it is checked.
 *
 * React and the SDK are PEER dependencies, which is the package-manager spelling of the build's `external`: the page
 * provides them and the plugin uses those, so a project installing the plugin never gets a second copy to fight with.
 * They are dev dependencies too, because the preview renders a page of its own.
 */

const packageJson = ({ packageName, base }: PluginNames, { packageManager, owner }: PluginAnswers): string =>
  `${JSON.stringify(
    {
      name: packageName,
      version: '0.1.0',
      license: 'MIT',
      ...(owner ? { author: owner } : {}),
      type: 'module',
      files: ['dist'],
      exports: { '.': `./dist/${base}.mjs`, './plugin-manifest.json': './dist/plugin-manifest.json' },
      scripts: {
        start: 'vite',
        build: 'vite build',
        zip: 'vite build && node build/zip.ts',
        typecheck: 'tsc -p tsconfig.json --noEmit',
        lint: 'eslint .',
        format: 'prettier --write .',
        visual: 'playwright test'
      },
      peerDependencies: {
        '@plitzi/plitzi-sdk': SDK_VERSION,
        react: REACT_VERSION,
        'react-dom': REACT_VERSION
      },
      devDependencies: {
        ...SHARED_DEV_DEPENDENCIES,
        '@plitzi/plitzi-sdk': SDK_VERSION,
        '@plitzi/sdk-authoring': SDK_VERSION,
        fflate: '^0.8.3',
        react: REACT_VERSION,
        'react-dom': REACT_VERSION,
        vite: VITE_VERSION
      },
      // The build scripts are TypeScript that Node runs by stripping the types, which it does from 22.18.
      engines: { node: '>=22.18' },
      ...managerPackageFields(packageManager)
    },
    null,
    2
  )}\n`;

/**
 * Written out rather than serialised: \`JSON.stringify\` puts every array entry on a line of its own, where the project's
 * own Prettier keeps a short list on one — and a file the formatter rewrites on the first save is noise in the first diff.
 */
const tsconfig = (): string => `{
  "compilerOptions": {
    "target": "ES2023",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "types": ["node", "vite/client"],
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx"
  },
  "include": ["src", "preview", "build", "visual", "vite.config.ts", "playwright.config.ts"]
}
`;

/** Yarn's own recommendation: with the `node-modules` linker it writes a cache into `.yarn/` that no repository wants. */
const YARN_IGNORES = '\n.yarn/*\n!.yarn/patches\n!.yarn/plugins\n!.yarn/releases\n!.yarn/versions\n';

const gitignore = ({ packageManager, inProject }: PluginAnswers): string =>
  `node_modules\ndist\n*.zip\nvisual/.results\n${packageManager === 'yarn' && !inProject ? YARN_IGNORES : ''}`;

export const packageFiles = (names: PluginNames, answers: PluginAnswers): ProjectFiles => ({
  'package.json': packageJson(names, answers),
  'tsconfig.json': tsconfig(),
  '.gitignore': gitignore(answers)
});
