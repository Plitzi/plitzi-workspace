import Form from '@plitzi/plitzi-ui/Form';

export type CdnBucketFieldsProps = {
  provider: string;
  visibility: string;
};

/**
 * A bucket's fields — the bucket as the provider knows it, its region on S3, who may read it and, when public, where —
 * inside a form that holds them.
 */
const CdnBucketFields = ({ provider, visibility }: CdnBucketFieldsProps) => (
  <>
    <Form.Input name="bucketName" label="Bucket Name" size="xs" />
    {provider === 's3' && <Form.Input name="region" label="Bucket Region" size="xs" />}
    <Form.Select name="visibility" label="Visibility" size="xs">
      <option value="public">Public — plugins, images and snippets, served at its domain</option>
      <option value="private">Private — the space’s server code, read only by Plitzi</option>
    </Form.Select>
    {visibility === 'private' && (
      <p className="text-xs text-gray-500 dark:text-zinc-400">
        Use a bucket with no public access: Plitzi reads it with the CDN’s credential, and keeps the space’s functions
        and runtime there.
      </p>
    )}
    {visibility !== 'private' && <Form.Input name="domain" label="Bucket Domain" size="xs" />}
  </>
);

export default CdnBucketFields;
