import type { ComponentDefinition, PluginDeclaration } from '../types';
import type { FC } from 'react';

/** A plugin as its bundle exports it: the component, with the declaration its `index.ts` assigned onto it. */
export type DeclaredPlugin = FC<never> & {
  content?: ComponentDefinition;
  version?: string;
  initialItems?: string[];
  plugins?: Record<string, DeclaredPlugin>;
};

const isReactElement = (value: unknown): boolean => typeof value === 'object' && value !== null && '$$typeof' in value;

// A definition is data but for what only the builder draws — a market icon given as an element — which a page has no
// use for and could not carry.
const asData = (content: ComponentDefinition): ComponentDefinition =>
  // `JSON.parse` returns `any`: the shape is the one just serialised, minus what the replacer dropped.
  JSON.parse(
    JSON.stringify(content, (_key, value: unknown) =>
      typeof value === 'function' || isReactElement(value) ? undefined : value
    )
  ) as ComponentDefinition;

export const pluginDeclarationOf = (plugin: DeclaredPlugin): PluginDeclaration => ({
  ...(plugin.content ? { content: asData(plugin.content) } : {}),
  ...(plugin.version ? { version: plugin.version } : {}),
  ...(plugin.initialItems ? { initialItems: [...plugin.initialItems] } : {}),
  ...(plugin.plugins
    ? {
        plugins: Object.fromEntries(
          Object.entries(plugin.plugins).map(([type, sub]) => [type, pluginDeclarationOf(sub)])
        )
      }
    : {})
});

/** The element types a plugin registered under `type` renders: its own and its sub-plugins', at any depth. */
export const pluginTypesOf = (type: string, declaration: PluginDeclaration): string[] => [
  type,
  ...Object.entries(declaration.plugins ?? {}).flatMap(([subType, sub]) => pluginTypesOf(subType, sub))
];
