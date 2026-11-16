import { createHash, createHmac } from 'node:crypto';

/**
 * AWS Signature Version 4, for the few calls a deploy makes (S3 and the storages that speak it — R2, MinIO,
 * SeaweedFS —, CloudFront, Amplify): a request signed here is one `fetch`, with no SDK to install for a server that
 * otherwise never talks to AWS.
 */

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  /** A temporary credential's (an assumed role's). */
  sessionToken?: string;
}

export interface AwsRequest {
  method: string;
  url: URL;
  headers?: Record<string, string>;
  body?: Uint8Array | string;
  region: string;
  /** `s3`, `cloudfront`, `amplify`… */
  service: string;
  credentials: AwsCredentials;
  /** The moment it is signed at; now when left out. */
  now?: Date;
}

const sha256 = (data: Uint8Array | string): string => createHash('sha256').update(data).digest('hex');

const hmac = (key: Uint8Array | string, data: string): Buffer => createHmac('sha256', key).update(data).digest();

/** RFC 3986's unreserved characters left as they are, everything else percent-encoded — what SigV4 asks. */
export const awsEncode = (value: string): string =>
  encodeURIComponent(value).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

/** The path as SigV4 reads it: each segment encoded once (S3's rule, and the same for the paths other services use). */
const canonicalPath = (url: URL): string =>
  url.pathname
    .split('/')
    .map(segment => awsEncode(decodeURIComponent(segment)))
    .join('/') || '/';

const canonicalQuery = (url: URL): string =>
  [...url.searchParams.entries()]
    .map(([key, value]) => [awsEncode(key), awsEncode(value)])
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

/** `20261116T183000Z` and `20261116`. */
const stamps = (now: Date): { amzDate: string; day: string } => {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');

  return { amzDate, day: amzDate.slice(0, 8) };
};

/** The headers a request is sent with, signed: its own, plus `host`, `x-amz-date`, the payload's digest and `authorization`. */
export const signAws = ({
  method,
  url,
  headers = {},
  body = '',
  region,
  service,
  credentials,
  now = new Date()
}: AwsRequest): Record<string, string> => {
  const { amzDate, day } = stamps(now);
  const payloadHash = sha256(body);
  const signed: Record<string, string> = {
    ...Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value.trim()])),
    host: url.host,
    'x-amz-date': amzDate,
    // S3 asks for the payload's digest as a header of its own; the other services read it off the signature alone.
    ...(service === 's3' ? { 'x-amz-content-sha256': payloadHash } : {}),
    ...(credentials.sessionToken ? { 'x-amz-security-token': credentials.sessionToken } : {})
  };
  const names = Object.keys(signed).sort();
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalPath(url),
    canonicalQuery(url),
    names.map(name => `${name}:${signed[name].replace(/\s+/g, ' ')}\n`).join(''),
    names.join(';'),
    payloadHash
  ].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
  const key = hmac(hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, day), region), service), 'aws4_request');
  const signature = createHmac('sha256', key).update(toSign).digest('hex');

  return {
    ...signed,
    authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`
  };
};

/** What AWS answered when it refused, in its own words — the `<Message>` of its XML, or the `message` of its JSON. */
export const awsRefusal = async (response: Response, doing: string): Promise<Error> => {
  const text = await response.text().catch(() => '');
  const said =
    /<Message>([^<]*)<\/Message>/.exec(text)?.[1] ?? /"message"\s*:\s*"([^"]*)"/i.exec(text)?.[1] ?? text.slice(0, 200);

  return new Error(`${doing} was refused (${String(response.status)})${said ? `: ${said}` : ''}`);
};

/** A signed request, sent. */
export const awsFetch = async (request: AwsRequest & { signal?: AbortSignal }): Promise<Response> => {
  // `host` is signed, and sent by `fetch` itself from the address.
  const sent = Object.fromEntries(Object.entries(signAws(request)).filter(([name]) => name !== 'host'));

  return fetch(request.url, {
    method: request.method,
    headers: sent,
    ...(request.body === undefined || request.method === 'GET' || request.method === 'HEAD'
      ? {}
      : { body: typeof request.body === 'string' ? request.body : Buffer.from(request.body) }),
    ...(request.signal ? { signal: request.signal } : {})
  });
};
