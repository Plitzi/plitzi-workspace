import type { PluginManifest } from '@plitzi/sdk-shared';

export type Resource =
  | {
      id: string;
      name: string;
      path: string;
      type: 'image' | 'video' | 'document' | 'application';
      size: number;
    }
  | {
      id: string;
      name: string;
      path: string;
      type: 'plugin';
      size: number;
      metadata: PluginManifest;
    };

export type ResourceWithFile = Resource & { file: File };

export type ResourceFile = File & {
  id: number;
  resourceType: 'image' | 'video' | 'document' | 'application' | 'plugin';
  metadata?: PluginManifest;
};
