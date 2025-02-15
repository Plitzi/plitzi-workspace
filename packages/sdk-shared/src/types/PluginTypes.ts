import type { ComponentDefinition } from './ElementTypes';
import type { Element } from './SchemaTypes';

export type PluginSchema = {
  attributes: Element['attributes'];
  builder: PluginBuilder;
  definition: Element['definition'];
  defaultStyle: {
    name: string;
    displayMode: string;
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
  type: 'style' | 'script';
};

export type PluginManifest = Record<string, unknown> & {
  assets: Record<string, { integrity: string; src: string; srcPath: string; type: 'style' | 'script' }>;
  author: string;
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
  canMove?: boolean;
  canTemplate?: boolean;
  itemsAllowed: string[];
  itemsNotAllowed: string[];
};

export type Asset =
  | {
      id: string;
      type: 'link';
      params: { href: string; type: 'text/css'; rel: 'stylesheet' } & Record<string, unknown>;
    }
  | { id: string; type: 'script'; params: { src: string; type: 'text/javascript' } & Record<string, unknown> };

export type Plugin = {
  assets: Pick<ManifestAsset, 'type' | 'url'>[];
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
  assets?: Record<string, Asset>;
  plugins?: Record<string, Plugin>;
  dispatchPlugins?: unknown;
  fetch?: unknown;
  add?: unknown;
  setSettings?: unknown;
  getSettings?: unknown;
  update?: unknown;
  remove?: unknown;
  registerCustomAssets?: unknown;
  unregisterCustomAssets?: unknown;
  pluginStyles?: Record<string, string[]>;
};
