import type { PluginManifest } from './PluginTypes';
import type { SpaceCredential } from './SpaceTypes';

/** `server`: a file of the space's server code — its functions or runtime — on a private CDN. */
export type ResourceType = 'image' | 'video' | 'document' | 'application' | 'plugin' | 'template' | 'server';

export type Resource =
  | {
      id: string;
      cdnIdentifier: string;
      name: string;
      path: string;
      type: Exclude<ResourceType, 'plugin'>;
      size: number;
      /** For server code, the versions of the space that run it (`draft`, `production r3`); it cannot be removed while any do. */
      usedBy: string[];
    }
  | {
      id: string;
      cdnIdentifier: string;
      name: string;
      path: string;
      type: 'plugin';
      size: number;
      metadata: PluginManifest;
      usedBy: string[];
    };

export type ResourceWithFile = Resource & { file: File };

export type ResourceFile = File & {
  id: number;
  resourceType: ResourceType;
  metadata?: PluginManifest;
};

/**
 * Who may read a CDN's files. `public`: anybody, at its domain — plugins, images, templates. `private`: only the platform,
 * with its credential — the space's server code. A private CDN has no domain.
 */
export type CdnVisibility = 'public' | 'private';

export type Cdn = {
  identifier: string;
  name: string;
  domain: string;
  visibility: CdnVisibility;
  provider: 's3' | 'r2';
  region: string;
  endpoint?: string;
  bucketName: string;
  prefix: string;
  credential?: SpaceCredential;
  createdAt: number;
  updatedAt: number;
};
