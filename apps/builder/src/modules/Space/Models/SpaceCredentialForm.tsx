/* eslint-disable react-refresh/only-export-components */

import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import { readSmtpCredential } from '@plitzi/sdk-shared/actions';

import type { SpaceCredentialProvider } from '@plitzi/sdk-shared';
import type { SmtpSecurity } from '@plitzi/sdk-shared/actions';
import type { MouseEvent } from 'react';

type SmtpFields = {
  host: string;
  port: string;
  security: SmtpSecurity;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
};

/** What a new SMTP credential starts from: the submission port most providers expect, upgraded to TLS. */
const SMTP_DEFAULTS: SmtpFields = {
  host: '',
  port: '587',
  security: 'starttls',
  username: '',
  password: '',
  fromEmail: '',
  fromName: ''
};

const SMTP_FIELDS: (keyof SmtpFields)[] = ['host', 'port', 'security', 'username', 'password', 'fromEmail', 'fromName'];

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
  // A connector credential is a generic key/value bag on purpose: adding a CMS must never mean adding an enum
  // value and a migration, so the shape stays open and the manifest decides what the keys mean.
  z.object({
    provider: z.literal('custom'),
    name: z.string().min(2),
    data: z
      .string()
      .min(2)
      .refine(value => {
        try {
          const parsed: unknown = JSON.parse(value);

          return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
        } catch {
          return false;
        }
      }, 'Expected a JSON object, for example { "token": "…" }')
  }),
  // The mail server a space's `email.send` steps go through. Judged by the same rule the task and the API apply, so a
  // credential this form accepts is one a flow can actually send with.
  z
    .object({
      provider: z.literal('smtp'),
      name: z.string().min(2),
      host: z.string(),
      port: z.string(),
      security: z.enum(['starttls', 'tls', 'none']),
      username: z.string(),
      password: z.string(),
      fromEmail: z.string(),
      fromName: z.string()
    })
    .superRefine((values, ctx) => {
      readSmtpCredential(values).problems.forEach(problem =>
        ctx.addIssue({ code: 'custom', path: [problem.key], message: problem.message })
      );
    }),
  z.object({
    provider: z.literal('ssr'),
    name: z.string().min(2),
    fields: z.discriminatedUnion('type', [
      z.object({
        type: z.literal('basic'),
        user: z.string().min(2).max(20),
        pass: z.string().min(2).max(50)
      }),
      z.object({
        type: z.literal('token'),
        token: z.string().min(10).max(100)
      })
    ])
  })
]);

type DefaultValuesProps = {
  name: string;
  provider: SpaceCredentialProvider;
  accessKeyId: string;
  secretAccessKey: string;
  type: 'basic' | 'token';
  user: string;
  pass: string;
  token: string;
};

/** One branch per provider, because the form's schema is a discriminated union and each arm carries its own keys. */
const getDefaultValues = ({
  name,
  provider,
  accessKeyId,
  secretAccessKey,
  type,
  user,
  pass,
  token
}: DefaultValuesProps): z.infer<typeof spaceCredentialFormSchema> => {
  if (provider === 'ssr') {
    return { name, provider, fields: { type, ...(type === 'basic' ? { user, pass } : { token }) } } as z.infer<
      typeof spaceCredentialFormSchema
    >;
  }

  if (provider === 'custom') {
    return { name, provider, data: '{\n  "token": ""\n}' };
  }

  if (provider === 'smtp') {
    return { name, provider, ...SMTP_DEFAULTS };
  }

  return { name, provider, accessKeyId, secretAccessKey };
};

export type SpaceCredentialFormProps = {
  className?: string;
  name?: string;
  provider?: SpaceCredentialProvider;
  accessKeyId?: string;
  secretAccessKey?: string;
  type?: 'basic' | 'token';
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
  type = 'basic',
  user = '',
  pass = '',
  token = '',
  onSubmit,
  onClose
}: SpaceCredentialFormProps) => {
  const form = useForm({
    defaultValues: getDefaultValues({ name, provider, accessKeyId, secretAccessKey, type, user, pass, token }),
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
      form.formMethods.resetField('data');
      if (value === 'custom') {
        form.formMethods.setValue('data', '{\n  "token": ""\n}');
      }

      if (value === 'smtp') {
        SMTP_FIELDS.forEach(key => form.formMethods.setValue(key, SMTP_DEFAULTS[key]));
      }

      if (value === 'ssr') {
        form.formMethods.setValue('fields', { type: 'basic', user: '', pass: '' });
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
          <option value="custom">CMS / Custom API</option>
          <option value="smtp">SMTP (email)</option>
        </Form.Select>
        <Form.Conditional when="provider" is={['s3', 'r2']}>
          <Form.Input name="accessKeyId" label="Access Key ID" size="xs" />
          <Form.Input name="secretAccessKey" label="Secret Access Key" size="xs" />
        </Form.Conditional>
        <Form.Conditional when="provider" is="custom">
          <Form.TextArea name="data" label="Credential Data (JSON)" size="xs" />
        </Form.Conditional>
        <Form.Conditional when="provider" is="smtp">
          <Form.Input name="host" label="Host" placeholder="smtp.example.com" size="xs" />
          <Form.Input name="port" label="Port" placeholder="587" size="xs" />
          <Form.Select name="security" label="Security" size="xs">
            <option value="starttls">STARTTLS (usually 587)</option>
            <option value="tls">TLS (usually 465)</option>
            <option value="none">None</option>
          </Form.Select>
          <Form.Input name="username" label="User" size="xs" />
          <Form.Input name="password" label="Password" size="xs" type="password" />
          <Form.Input name="fromEmail" label="Send as (email)" placeholder="hello@example.com" size="xs" />
          <Form.Input name="fromName" label="Send as (name)" size="xs" />
        </Form.Conditional>
        <Form.Conditional when="provider" is="ssr">
          <Form.Select name="fields.type" label="Auth Type" size="xs">
            <option value="basic">Basic</option>
            <option value="token">Token</option>
          </Form.Select>

          <Form.Conditional when="fields.type" is="basic">
            <Form.Input name="fields.user" label="User" size="xs" />
            <Form.Input name="fields.pass" label="Password" size="xs" type="password" />
          </Form.Conditional>

          <Form.Conditional when="fields.type" is="token">
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
