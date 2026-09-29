import Form from '@plitzi/plitzi-ui/Form';

export type CdnAccountFieldsProps = {
  provider: string;
  onChangeProvider?: (value: string) => void;
};

/** A CDN account's fields — its name, its provider and, on R2, its endpoint — inside a form that holds them. */
const CdnAccountFields = ({ provider, onChangeProvider }: CdnAccountFieldsProps) => (
  <>
    <Form.Input name="name" label="CDN Name" size="xs" />
    <Form.Select name="provider" label="CDN Provider" size="xs" onChange={onChangeProvider}>
      <option value="s3">AWS S3</option>
      <option value="r2">Cloudflare R2</option>
    </Form.Select>
    {provider === 'r2' && <Form.Input name="endpoint" label="CDN Endpoint" size="xs" />}
  </>
);

export default CdnAccountFields;
