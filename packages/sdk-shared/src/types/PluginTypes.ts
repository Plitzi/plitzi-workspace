import type { ComponentDefinition } from './ElementTypes';
import type { Element } from './SchemaTypes';
import type { DisplayMode } from './StyleTypes';

export type PluginSchema = {
  attributes: Element['attributes'];
  builder: PluginBuilder;
  initialItems?: string[];
  definition: Element['definition'];
  defaultStyle: {
    name: string;
    displayMode: DisplayMode;
    style: { [key: string]: { [key: string]: string | number } };
    subTypes?: { [key: string]: Omit<PluginSchema['defaultStyle'], 'subTypes'> };
    bindingsAllowed: {
      attributes: { path: string; label: string }[];
      initialState: { path: string; label: string }[];
    };
  };
};

export type ManifestAsset = {
  integrity?: string;
  src?: string;
  srcPath?: string;
  url?: string;
  type: 'style' | 'script'; // @todo: Asset['type'];
  isMain?: boolean;
};

export type PluginManifest = {
  assets: Record<string, ManifestAsset>;
  author: string;
  icon?: string;
  definition: {
    name: string;
    backgroundColor: string;
    category: string;
    icon: string;
    license: string;
    owner: string;
    verified: boolean;
    website: string;
  };
  pluginSchema: Record<string, PluginSchema>;
  root: string;
  runtime: {
    module: string;
    scope: string;
  };
  created: string;
  updated: string;
  version: string;
};

export type PluginBuilder = {
  canDelete?: boolean;
  canDragDrop?: boolean;
  canSelect?: boolean;
  canMove?: boolean;
  canTemplate?: boolean;
  itemsAllowed?: string[];
  itemsNotAllowed?: string[];
};

export type Asset =
  | {
      id: string;
      type: 'link';
      params: { href: string; type: 'text/css'; rel: 'stylesheet' } & Record<string, string>;
      isMain?: boolean;
    }
  | {
      id: string;
      type: 'script';
      params: { src: string; type: 'text/javascript' } & Record<string, string>;
      isMain?: boolean;
    };

export type Plugin = {
  assets: Asset[];
  attributes: ComponentDefinition['attributes'];
  builder: PluginBuilder;
  defaultStyle: ComponentDefinition['defaultStyle'];
  isMain?: boolean;
  manifest: PluginManifest;
  market: ComponentDefinition['market'];
  module: string;
  resource: string;
  scope: string;
  settings: Record<string, unknown>;
  subPlugins?: string[];
  type: string;
};

export type PluginsContextValue = {
  baseAssets?: Record<string, Asset>;
  assets: Record<string, Asset>;
  plugins: Record<string, ComponentDefinition>;
  dispatchPlugins?: unknown;
  fetch?: (filter: object, cursor: string, limit: number) => Promise<unknown>;
  add?: (pluginType: string, resource?: string) => Promise<boolean>;
  setSettings?: (pluginType: string, attribute: string, value: string) => Promise<boolean>;
  getSettings?: (
    pluginType: string,
    attribute?: string,
    defaultValue?: string | number | boolean
  ) => ComponentDefinition['settings'] | string | number | boolean;
  update?: (plugin: ComponentDefinition, resource?: string) => Promise<boolean>;
  remove?: (pluginType: string) => Promise<boolean>;
  registerCustomAssets: (assets: Asset[]) => void;
  unregisterCustomAssets: (assets: string[]) => void;
  pluginStyles?: Record<string, string[]>;
};

// Raw

export type PluginRaw = {
  resource: string;
  settings: Plugin['settings'];
  type: string;
};
