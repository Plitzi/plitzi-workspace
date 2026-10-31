import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm, useFormWatch } from '@plitzi/plitzi-ui/Form';
import { useCallback } from 'react';
import { z } from 'zod';

import Notice from '@pmodules/App/components/Notice';
import useSpaceEntitlements from '@pmodules/Space/hooks/useSpaceEntitlements';

import SnapshotPruneNotice from '../components/SnapshotPruneNotice';
import VersionContents from '../components/VersionContents';

import type { Environment } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

const publishFormSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  description: z.string().max(200, { message: 'Description must be less than 200 characters' })
});

export type PublishFormProps = {
  className?: string;
  environment?: Exclude<Environment, 'main'>;
  description?: string;
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: z.infer<typeof publishFormSchema>) => void;
};

const ENVIRONMENTS = [
  { value: 'development', label: 'Development' },
  { value: 'staging', label: 'Staging' },
  { value: 'production', label: 'Production' }
] as const;

const PublishForm = ({ environment, description = '', onClose, onSubmit }: PublishFormProps) => {
  // An environment the space's plan does not include is shown, and locked with the plan that does.
  const { included, locked } = useSpaceEntitlements();
  const first = ENVIRONMENTS.find(({ value }) => included(value))?.value ?? 'development';
  const form = useForm({
    defaultValues: { environment: environment ?? first, description },
    config: { schema: publishFormSchema }
  });

  const chosen = useFormWatch(form.formMethods, 'environment');

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof publishFormSchema>) => onSubmit?.(undefined, values),
    [onSubmit]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Notice tone="info" className="mb-4">
          Make a snapshot and save it into an environment to later publish it
        </Notice>
        <VersionContents environment="main" title="This snapshot will freeze" />
        <Notice tone="info">
          Feature flags are kept apart from snapshots: this one sends the draft's flags to the environment and keeps a
          copy only as a fallback. Rolling back to an older snapshot later keeps the environment's flags as they are.
        </Notice>
        <Form.Select name="environment" label="Environment" size="sm">
          {ENVIRONMENTS.map(({ value, label }) => {
            const requires = locked(value)?.requires;

            return (
              <option key={value} value={value} disabled={requires !== undefined}>
                {requires ? `${label} — ${requires} plan` : label}
              </option>
            );
          })}
        </Form.Select>
        <SnapshotPruneNotice environment={chosen} />
        <Form.TextArea name="description" label="Description" placeholder="Brief description changes..." size="sm" />
      </Form.Body>
      <Form.Footer justify="end">
        <Button onClick={onClose} size="sm">
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Snapshot
        </Button>
      </Form.Footer>
    </Form>
  );
};

export default PublishForm;
