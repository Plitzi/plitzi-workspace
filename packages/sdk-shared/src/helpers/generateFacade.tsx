import { omit } from '@plitzi/plitzi-ui/helpers';

import { isRecord } from './isRecord';

/** `@plitzi/sdk-shared` → `PlitziSdkShared`: the name a module is published under on `window`. */
const toPascalCase = (pkgName: string) =>
  pkgName
    .replace(/^@/, '')
    .replace(/[-/]/g, ' ')
    .replace(/\b\w/g, match => match.toUpperCase())
    .replace(/\s+/g, '');

/** The modules published on `window` under `windowKey` — a key chosen at run time, so read without a type to trust. */
const publishedModule = (windowKey: string, name: string): Record<string, unknown> => {
  const registry: unknown = Reflect.get(window, windowKey);
  const module = isRecord(registry) ? registry[name] : undefined;

  return isRecord(module) ? module : {};
};

const createFacadeBlob = (name: string, windowKey = 'PlitziFacade') => {
  const keys = typeof window !== 'undefined' ? Object.keys(publishedModule(windowKey, name)) : [];
  if (keys.length === 0) {
    return '';
  }

  const exports = keys
    .filter(key => key !== 'default')
    .map(k => `export const ${k} = window.${windowKey}.${name}.${k};`)
    .join('');

  return `export default window.${windowKey}.${name};${exports}`;
};

const createBlobURL = (code: string) => URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));

const getAllImportMaps = (): Record<string, string> => {
  const maps: Record<string, string> = {};
  if (typeof document === 'undefined') {
    return maps;
  }

  document.querySelectorAll<HTMLScriptElement>('script[type="importmap"]').forEach(script => {
    if (script.textContent) {
      try {
        const parsed = JSON.parse(script.textContent) as { imports?: Record<string, string> };
        if (parsed.imports) {
          Object.entries(parsed.imports).forEach(([key, val]) => {
            if (maps[key]) {
              console.warn(`Duplicated import detected: "${key}"`);
            }
            maps[key] = val;
          });
        }
      } catch (e) {
        console.error('Invalid importmap JSON', e);
      }
    }
  });

  return maps;
};

const generateImportMap = (modules: Record<string, unknown>, windowKey = 'PlitziFacade') => {
  return JSON.stringify({
    imports: Object.keys(modules)
      .map(moduleKey => ({ key: moduleKey, bob: createBlobURL(createFacadeBlob(toPascalCase(moduleKey), windowKey)) }))
      .reduce((acum, module) => ({ ...acum, [module.key]: module.bob }), {})
  });
};

const generateFacade = (modules: Record<string, unknown>, windowKey = 'PlitziFacade') => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  const currentModules = getAllImportMaps();
  const modulesFiltered = omit(modules, Object.keys(currentModules));
  if (Object.keys(modulesFiltered).length === 0) {
    return;
  }

  Reflect.set(
    window,
    windowKey,
    Object.fromEntries(Object.entries(modulesFiltered).map(([key, module]) => [toPascalCase(key), module]))
  );

  const importMapJSON = generateImportMap(modulesFiltered, windowKey);
  if (!importMapJSON) {
    return;
  }

  const script = document.createElement('script');
  script.type = 'importmap';
  script.textContent = importMapJSON;
  document.head.appendChild(script);
};

export default generateFacade;
