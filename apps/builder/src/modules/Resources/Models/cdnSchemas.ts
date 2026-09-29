import { z } from 'zod';

import type { RefinementCtx } from 'zod';

/** A CDN's account, as its forms take it: the customer's storage account — provider, and where R2 reaches it. */
export const cdnAccountShape = {
  name: z.string().min(2),
  provider: z.enum(['s3', 'r2']),
  endpoint: z.string().optional()
};

/** A bucket's configuration, as its forms take it. */
export const cdnBucketShape = {
  bucketName: z.string().min(2).max(255),
  region: z.string().optional(),
  visibility: z.enum(['public', 'private']),
  domain: z.string().optional()
};

/** What an account needs beyond its shape: R2 is reached at an endpoint of its own. */
export const checkCdnAccount = (
  { provider, endpoint }: { provider: 's3' | 'r2'; endpoint?: string },
  ctx: RefinementCtx
): void => {
  if (provider === 'r2' && (endpoint?.trim().length ?? 0) < 2) {
    ctx.addIssue({ code: 'custom', path: ['endpoint'], message: 'An R2 account needs its endpoint' });
  }
};

/**
 * What a bucket needs beyond its shape: an S3 bucket lives in a region of its own, and a public bucket is read at its
 * domain — a private one has none: only Plitzi reads it, with the CDN's credential.
 */
export const checkCdnBucket = (
  provider: 's3' | 'r2',
  { region, visibility, domain }: { region?: string; visibility: 'public' | 'private'; domain?: string },
  ctx: RefinementCtx
): void => {
  if (provider === 's3' && (region?.trim().length ?? 0) < 2) {
    ctx.addIssue({ code: 'custom', path: ['region'], message: 'An S3 bucket needs its region' });
  }

  if (visibility === 'public' && (domain?.trim().length ?? 0) < 2) {
    ctx.addIssue({ code: 'custom', path: ['domain'], message: 'A public bucket needs its domain' });
  }
};
