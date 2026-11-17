import { awsEncode, awsFetch, awsRefusal } from './sigv4';

import type { AwsCredentials } from './sigv4';
import type { DeployLog, SiteFile, SiteUploader, UploadResult } from '../types';

/**
 * A site written to an S3 bucket — AWS's, or any storage that speaks its API (Cloudflare R2, MinIO, SeaweedFS) — and,
 * when a CloudFront distribution fronts it, switched there in one step: each deploy is written under a
 * prefix of its own, then the distribution's origin is pointed at that prefix, so a visitor sees the old site or the
 * new one, never half of each; going back is pointing it at the previous prefix again. Without a distribution the files
 * are replaced where they are, one by one, and the log says so before it starts.
 */

export interface S3Target {
  bucket: string;
  region: string;
  credentials: AwsCredentials;
  /** A storage other than AWS's (`https://<account>.r2.cloudflarestorage.com`): addressed path-style. */
  endpoint?: string;
  /** Where the site lives in the bucket, without slashes at its ends; the bucket's root when left out. */
  prefix?: string;
}

export interface CloudFrontTarget {
  distributionId: string;
  credentials: AwsCredentials;
  /** CloudFront's API, when it is not AWS's own address (a test's). */
  endpoint?: string;
}

/** How many files go up at once. */
const PARALLEL = 8;

const CACHE_CONTROL: Record<SiteFile['cache'], string> = {
  immutable: 'public, max-age=31536000, immutable',
  revalidate: 'public, max-age=0, must-revalidate'
};

const joinKey = (...parts: (string | undefined)[]): string =>
  parts
    .filter((part): part is string => Boolean(part))
    .map(part => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');

/** The address of an object, virtual-hosted on AWS and path-style elsewhere. */
export const objectUrl = ({ bucket, region, endpoint }: S3Target, key: string): URL => {
  const path = key.split('/').map(awsEncode).join('/');

  return endpoint
    ? new URL(`${endpoint.replace(/\/+$/, '')}/${bucket}/${path}`)
    : new URL(`https://${bucket}.s3.${region}.amazonaws.com/${path}`);
};

/** Writes one object. */
export const putObject = async (
  target: S3Target,
  key: string,
  file: Pick<SiteFile, 'body' | 'type' | 'cache'>,
  signal?: AbortSignal
): Promise<void> => {
  const response = await awsFetch({
    method: 'PUT',
    url: objectUrl(target, key),
    headers: { 'content-type': file.type, 'cache-control': CACHE_CONTROL[file.cache] },
    body: file.body,
    region: target.region,
    service: 's3',
    credentials: target.credentials,
    ...(signal ? { signal } : {})
  });
  if (!response.ok) {
    throw await awsRefusal(response, `Writing ${key} to the bucket ${target.bucket}`);
  }
};

/** Whether an object is there already: an immutable file — named by its content — is never written twice. */
const exists = async (target: S3Target, key: string, signal?: AbortSignal): Promise<boolean> => {
  const response = await awsFetch({
    method: 'HEAD',
    url: objectUrl(target, key),
    region: target.region,
    service: 's3',
    credentials: target.credentials,
    ...(signal ? { signal } : {})
  });

  return response.ok;
};

/** Every file written under `prefix`, a few at a time; the immutable ones a bucket already holds are left as they are. */
export const putFiles = async (
  target: S3Target,
  prefix: string,
  files: SiteFile[],
  log: DeployLog,
  signal?: AbortSignal
): Promise<{ written: number; kept: number; bytes: number }> => {
  let written = 0;
  let kept = 0;
  let bytes = 0;
  const queue = [...files];
  const work = async (): Promise<void> => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      signal?.throwIfAborted();
      const key = joinKey(target.prefix, prefix, file.path);
      if (file.cache === 'immutable' && (await exists(target, key, signal))) {
        kept += 1;
        continue;
      }

      await putObject(target, key, file, signal);
      written += 1;
      bytes += file.body.byteLength;
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, files.length) }, work));
  log(
    `Wrote ${String(written)} files (${String(Math.round(bytes / 1024))} KB) to ${target.bucket}${kept ? `; ${String(kept)} were there already` : ''}`
  );

  return { written, kept, bytes };
};

const CLOUDFRONT = 'https://cloudfront.amazonaws.com/2020-05-31';

/** Asks CloudFront to forget what it keeps of `paths` (`/*`: everything), so the next visitor gets the new site. */
export const invalidateCloudFront = async (
  { distributionId, credentials, endpoint = CLOUDFRONT }: CloudFrontTarget,
  paths: string[],
  reference: string,
  signal?: AbortSignal
): Promise<void> => {
  const items = paths.map(path => `<Path>${path.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Path>`).join('');
  const body = `<?xml version="1.0" encoding="UTF-8"?><InvalidationBatch xmlns="http://cloudfront.amazonaws.com/doc/2020-05-31/"><Paths><Quantity>${String(paths.length)}</Quantity><Items>${items}</Items></Paths><CallerReference>${reference}</CallerReference></InvalidationBatch>`;
  const response = await awsFetch({
    method: 'POST',
    url: new URL(`${endpoint}/distribution/${encodeURIComponent(distributionId)}/invalidation`),
    headers: { 'content-type': 'application/xml' },
    body,
    region: 'us-east-1',
    service: 'cloudfront',
    credentials,
    ...(signal ? { signal } : {})
  });
  if (!response.ok) {
    throw await awsRefusal(response, `Clearing CloudFront's copy (${distributionId})`);
  }
};

/**
 * Points the distribution's origin for `bucket` at `originPath`: what makes a deploy written under its own prefix the
 * site, in one step. The rest of the distribution's configuration is sent back as CloudFront gave it.
 */
export const pointCloudFront = async (
  { distributionId, credentials, endpoint = CLOUDFRONT }: CloudFrontTarget,
  bucket: string,
  originPath: string,
  signal?: AbortSignal
): Promise<{ previous: string }> => {
  const url = new URL(`${endpoint}/distribution/${encodeURIComponent(distributionId)}/config`);
  const read = await awsFetch({
    method: 'GET',
    url,
    region: 'us-east-1',
    service: 'cloudfront',
    credentials,
    ...(signal ? { signal } : {})
  });
  if (!read.ok) {
    throw await awsRefusal(read, `Reading the CloudFront distribution ${distributionId}`);
  }

  const etag = read.headers.get('etag') ?? '';
  const config = await read.text();
  const origins = [...config.matchAll(/<Origin>([\s\S]*?)<\/Origin>/g)];
  const origin =
    origins.find(([, inner]) =>
      new RegExp(`<DomainName>${bucket.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`).test(inner)
    ) ?? (origins.length === 1 ? origins[0] : undefined);
  if (!origin) {
    throw new Error(
      `The distribution ${distributionId} has no origin for the bucket ${bucket}: add it as an origin there, or name the bucket it serves`
    );
  }

  const [whole, inner] = origin;
  const previous = /<OriginPath>([^<]*)<\/OriginPath>/.exec(inner)?.[1] ?? '';
  const pointed = /<OriginPath>[^<]*<\/OriginPath>|<OriginPath\/>/.test(inner)
    ? inner.replace(/<OriginPath>[^<]*<\/OriginPath>|<OriginPath\/>/, `<OriginPath>${originPath}</OriginPath>`)
    : inner.replace(/(<DomainName>[^<]*<\/DomainName>)/, `$1<OriginPath>${originPath}</OriginPath>`);
  const write = await awsFetch({
    method: 'PUT',
    url,
    headers: { 'content-type': 'application/xml', 'if-match': etag },
    body: config.replace(whole, `<Origin>${pointed}</Origin>`),
    region: 'us-east-1',
    service: 'cloudfront',
    credentials,
    ...(signal ? { signal } : {})
  });
  if (!write.ok) {
    throw await awsRefusal(
      write,
      `Pointing the CloudFront distribution ${distributionId} at ${originPath || 'the bucket root'}`
    );
  }

  return { previous };
};

/**
 * An uploader for a bucket: with a distribution, every deploy under `deploys/<reference>` and the distribution switched
 * to it; without one, the files written over the site's.
 */
export const s3Uploader = (
  target: S3Target,
  options: { cloudFront?: CloudFrontTarget; reference: string }
): SiteUploader => ({
  name: `${target.endpoint ? 'Bucket' : 'S3 bucket'} ${target.bucket}${options.cloudFront ? ` behind CloudFront ${options.cloudFront.distributionId}` : ''}`,
  atomic: Boolean(options.cloudFront),
  upload: async (files, log, signal): Promise<UploadResult> => {
    const { cloudFront, reference } = options;
    if (!cloudFront) {
      log(
        `No CloudFront distribution: the files are replaced one by one, so for a few seconds a visitor may get some of each version`,
        'warn'
      );
      const { written, kept, bytes } = await putFiles(target, '', files, log, signal);

      return { files: written + kept, bytes, reference: joinKey(target.prefix) || '/' };
    }

    const prefix = joinKey('deploys', reference);
    const { written, kept, bytes } = await putFiles(target, prefix, files, log, signal);
    const originPath = `/${joinKey(target.prefix, prefix)}`;
    const { previous } = await pointCloudFront(cloudFront, target.bucket, originPath, signal);
    log(
      `CloudFront ${cloudFront.distributionId} serves ${originPath} now (it served ${previous || 'the bucket root'})`
    );
    await invalidateCloudFront(cloudFront, ['/*'], reference, signal);
    log('Asked CloudFront to drop its copies: visitors get the new site within a few minutes');

    return { files: written + kept, bytes, reference: originPath };
  }
});
