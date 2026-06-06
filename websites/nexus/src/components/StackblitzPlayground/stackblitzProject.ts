import type { Project } from '@stackblitz/sdk';

const VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()]
});`;

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>@plitzi/nexus Demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

const MAIN_TSX = `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);`;

export const buildProject = (
  demoId: string,
  demoCode: string
): Project => {
  const appCode = demoCode.includes('export default')
    ? demoCode
    : `import { createStoreHook, StoreProvider } from '@plitzi/nexus';

type State = {
  count: number;
  user: { name: string };
};

const { useStore } = createStoreHook<State>();

const Demo = () => {
${demoCode
  .split('\n')
  .map(line => (line.trim() ? `  ${line}` : ''))
  .join('\n')}
};

export default Demo;`;

  return {
    title: `@plitzi/nexus demo — ${demoId}`,
    description: 'Interactive Stackblitz demo for @plitzi/nexus',
    template: 'node',
    files: {
      'package.json': JSON.stringify(
        {
          name: `nexus-demo-${demoId}`,
          private: true,
          type: 'module',
          scripts: { dev: 'vite', build: 'tsc --noEmit && vite build' },
          dependencies: {
            react: '^19.0.0',
            'react-dom': '^19.0.0',
            '@plitzi/nexus': 'latest'
          },
          devDependencies: {
            '@vitejs/plugin-react': '^4.0.0',
            typescript: '^5.0.0',
            vite: '^6.0.0',
            '@types/react': '^19.0.0',
            '@types/react-dom': '^19.0.0'
          }
        },
        null,
        2
      ),
      'index.html': INDEX_HTML,
      'vite.config.ts': VITE_CONFIG,
      'src/main.tsx': MAIN_TSX,
      'src/App.tsx': appCode,
      'tsconfig.json': JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            jsx: 'react-jsx',
            strict: true,
            noEmit: true,
            isolatedModules: true
          },
          include: ['src']
        },
        null,
        2
      )
    }
  };
};
