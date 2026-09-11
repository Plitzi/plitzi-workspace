import type { ComponentPlugin } from '@plitzi/sdk-shared';

export type PlitziModule = {
  default: ComponentPlugin;
  version?: string;
  initialItems?: string[];
  plugins?: Record<string, ComponentPlugin>;
};

/**
 * A remote plugin, fetched and imported as an ES module.
 *
 * Always as a module, whatever the URL is called: nothing about an address says which format it serves, and every
 * plugin the template builds is ESM. There is no second path for the webpack bundles that registered themselves on a
 * `window` global — nothing produces those any more.
 */
export const generatePluginModule = async (url: string): Promise<PlitziModule | undefined> => {
  try {
    const response = await fetch(url);
    const moduleBlob = new Blob([await response.text()], { type: 'text/javascript' });

    return (await import(/* @vite-ignore */ /* webpackIgnore: true */ URL.createObjectURL(moduleBlob))) as PlitziModule;
  } catch (e) {
    console.log(e);

    return undefined;
  }
};
