/**
 * What every CDN document selects of a CDN — its account and its buckets — so the list and every mutation that answers
 * a CDN read it the same way.
 */
export const CDN_FIELDS = /* GraphQL */ `
  identifier
  name
  provider
  endpoint
  prefix
  credential {
    identifier
  }
  buckets {
    identifier
    name
    bucketName
    region
    visibility
    domain
  }
`;
