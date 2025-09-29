import type { PluginManifest } from '@plitzi/sdk-shared';

export type Resource =
  | {
      id: string;
      cdnIdentifier: string;
      name: string;
      path: string;
      type: 'image' | 'video' | 'document' | 'application';
      size: number;
    }
  | {
      id: string;
      cdnIdentifier: string;
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

export type Cdn = {
  id: number;
  identifier: string;
  name: string;
  domain: string;
  provider: 's3' | 'r2';
  region: string;
  endpoint?: string;
  bucketName: string;
  createdAt: number;
  updatedAt: number;
};
