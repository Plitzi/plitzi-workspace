/* eslint-disable react-refresh/only-export-components */

import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import type { SpaceCredentialProvider } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export const spaceCredentialFormSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('s3'),
    name: z.string().min(2),
    accessKeyId: z.string().min(1),
    secretAccessKey: z.string().min(1)
  }),
  z.object({
    provider: z.literal('r2'),
    name: z.string().min(2),
    accessKeyId: z.string().min(1),
    secretAccessKey: z.string().min(1)
  }),
  z.object({
    provider: z.literal('ssr'),
    name: z.string().min(2),
    fields: z.discriminatedUnion('authType', [
      z.object({
        authType: z.literal('basic'),
        user: z.string().min(2).max(20),
        pass: z.string().min(2).max(50)
      }),
      z.object({
        authType: z.literal('token'),
        token: z.string().min(10).max(100)
      })
    ])
  })
]);

export type SpaceCredentialFormProps = {
  className?: string;
  name?: string;
  provider?: SpaceCredentialProvider;
  accessKeyId?: string;
  secretAccessKey?: string;
  authType?: 'basic' | 'token';
  user?: string;
  pass?: string;
  token?: string;
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: z.infer<typeof spaceCredentialFormSchema>) => void;
};

const SpaceCredentialForm = ({
  name = 'New Credential',
  provider = 's3',
  accessKeyId = '',
  secretAccessKey = '',
  authType = 'basic',
  user = '',
  pass = '',
  token = '',
  onSubmit,
  onClose
}: SpaceCredentialFormProps) => {
  const form = useForm({
    defaultValues:
      provider === 'ssr'
        ? {
            name,
            provider,
            fields: {
              authType,
              ...(authType === 'basic' ? { user, pass } : { token })
            }
          }
        : { name, provider, accessKeyId, secretAccessKey },
    config: { schema: spaceCredentialFormSchema }
  });

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof spaceCredentialFormSchema>) => onSubmit?.(undefined, values),
    [onSubmit]
  );

  const handleChangeProvider = useCallback(
    (value: string) => {
      form.formMethods.resetField('fields');
      form.formMethods.resetField('accessKeyId');
      form.formMethods.resetField('secretAccessKey');
      if (value === 'ssr') {
        form.formMethods.setValue('fields', { authType: 'basic', user: '', pass: '' });
      }
    },
    [form.formMethods]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Input name="name" label="Name" size="xs" />
        <Form.Select name="provider" label="Provider" size="xs" onChange={handleChangeProvider}>
          <option value="s3">AWS S3</option>
          <option value="r2">Cloudflare R2</option>
          <option value="ssr">Plitzi SSR</option>
        </Form.Select>
        <Form.Conditional when="provider" is={['s3', 'r2']}>
          <Form.Input name="accessKeyId" label="Access Key ID" size="xs" />
          <Form.Input name="secretAccessKey" label="Secret Access Key" size="xs" />
        </Form.Conditional>
        <Form.Conditional when="provider" is="ssr">
          <Form.Select name="fields.authType" label="Auth Type" size="xs">
            <option value="basic">Basic</option>
            <option value="token">Token</option>
          </Form.Select>

          <Form.Conditional when="fields.authType" is="basic">
            <Form.Input name="fields.user" label="User" size="xs" />
            <Form.Input name="fields.pass" label="Password" size="xs" type="password" />
          </Form.Conditional>

          <Form.Conditional when="fields.authType" is="token">
            <Form.Input name="fields.token" label="Token" size="xs" />
          </Form.Conditional>
        </Form.Conditional>
      </Form.Body>
      <Form.Footer justify="end">
        <Button onClick={onClose} size="sm">
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Submit
        </Button>
      </Form.Footer>
    </Form>
  );
};

export default SpaceCredentialForm;
