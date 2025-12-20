import type { PluginManifest } from './PluginTypes';

export type ResourceType = 'image' | 'video' | 'document' | 'application' | 'plugin' | 'template';

export type Resource =
  | {
      id: string;
      cdnIdentifier: string;
      name: string;
      path: string;
      type: Exclude<ResourceType, 'plugin'>;
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
  resourceType: ResourceType;
  metadata?: PluginManifest;
};

export type Cdn = {
  identifier: string;
  name: string;
  domain: string;
  provider: 's3' | 'r2';
  region: string;
  endpoint?: string;
  bucketName: string;
  prefix: string;
  credential?: Credential;
  createdAt: number;
  updatedAt: number;
};
