import type { PluginAction, PluginSource, PluginSourceComponent } from '../types';

export const isComponentSource = (source: PluginSource): source is PluginSourceComponent => 'component' in source;

export const detectAction = (js: string): PluginAction => {
  if (js.startsWith('http://') || js.startsWith('https://')) {
    return 'copy';
  }

  if (js.endsWith('.tsx') || js.endsWith('.ts') || js.endsWith('.jsx')) {
    return 'compile';
  }

  return 'copy';
};
