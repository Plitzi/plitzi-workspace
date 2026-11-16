import { describe, expect, it } from 'vitest';

import { awsEncode, signAws } from './sigv4';

/** AWS's own test suite (`aws-sig-v4-test-suite`), the case every signer is checked against first. */
const EXAMPLE = {
  region: 'us-east-1',
  service: 'service',
  credentials: { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' },
  now: new Date('2015-08-30T12:36:00Z')
};

describe('signAws', () => {
  it('signs as AWS’s own suite says (get-vanilla)', () => {
    const headers = signAws({ ...EXAMPLE, method: 'GET', url: new URL('https://example.amazonaws.com/') });

    expect(headers.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31'
    );
  });

  it('signs S3’s payload digest, and a temporary credential’s token', () => {
    const headers = signAws({
      ...EXAMPLE,
      service: 's3',
      credentials: { ...EXAMPLE.credentials, sessionToken: 'token' },
      method: 'PUT',
      url: new URL('https://bucket.s3.us-east-1.amazonaws.com/index.html'),
      body: 'hi'
    });

    expect(headers['x-amz-content-sha256']).toBe('8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4');
    expect(headers.authorization).toContain('SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-security-token');
  });

  it('encodes what RFC 3986 reserves, and nothing it leaves', () => {
    expect(awsEncode("a b(c)*!'~-_.")).toBe('a%20b%28c%29%2A%21%27~-_.');
  });
});
