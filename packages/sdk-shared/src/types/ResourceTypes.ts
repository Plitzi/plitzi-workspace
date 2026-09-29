import type { PluginManifest } from './PluginTypes';
import type { SpaceCredential } from './SpaceTypes';

/** `server`: a file of the space's server code — its functions or runtime — in a private bucket. */
export type ResourceType = 'image' | 'video' | 'document' | 'application' | 'plugin' | 'template' | 'server';

export type Resource =
  | {
      id: string;
      cdnIdentifier: string;
      /** Which of the CDN's buckets it is in. */
      bucketIdentifier: string;
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
      bucketIdentifier: string;
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
 * Who may read a bucket's files. `public`: anybody, at its domain — plugins, images, templates. `private`: only the
 * platform, with its CDN's credential — the space's server code. A private bucket has no domain.
 */
export type CdnVisibility = 'public' | 'private';

/** One bucket of a CDN, with its own configuration. */
export type CdnBucket = {
  identifier: string;
  name: string;
  /** The bucket as the provider knows it. */
  bucketName: string;
  /** An S3 bucket's own region; `auto` on R2. */
  region: string;
  visibility: CdnVisibility;
  /** Where a public bucket's files are served; empty for a private one. */
  domain: string;
};

/** A space's storage account — the customer's own, which they run and pay for — and its buckets. */
export type Cdn = {
  identifier: string;
  name: string;
  provider: 's3' | 'r2';
  endpoint?: string;
  prefix: string;
  credential?: SpaceCredential;
  buckets: CdnBucket[];
  createdAt: number;
  updatedAt: number;
};
