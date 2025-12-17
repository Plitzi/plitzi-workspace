import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm, useFormWatch } from '@plitzi/plitzi-ui/Form';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';

import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import type { MouseEvent } from 'react';

const deployFormSchema = z.object({
  environment: z.enum(['main', 'production', 'staging', 'development']),
  domain: z.string().min(3, 'Domain must have at least 3 characters'),
  revision: z.coerce.number().optional()
});

export type DeployFormProps = {
  environment?: 'main' | 'production' | 'staging' | 'development';
  domain?: string;
  revision?: number;
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: z.infer<typeof deployFormSchema>) => void;
};

const DeployForm = ({ environment = 'main', domain = '', revision = 0, onClose, onSubmit }: DeployFormProps) => {
  const { data: domains = [], isLoading: isLoadingDomains } = useGraphQL(
    'SpaceDeployments',
    data => data?.SpaceDeployments.edges
  );

  const form = useForm({ defaultValues: { environment, domain, revision }, config: { schema: deployFormSchema } });
  const watchEnvironment = useFormWatch(form.formMethods, 'environment');
  const watchDomain = useFormWatch(form.formMethods, 'domain');
  const { data: latestRevision = 0, isLoading: isLoadingLatestRevision } = useGraphQL(
    'SpaceLatestRevision',
    data => data?.SpaceLatestRevision?.snapshot?.revision,
    { environment: watchEnvironment }
  );
  const domainSelected = useMemo(() => domains.find(domain => domain.domain === watchDomain), [domains, watchDomain]);
  const loading = isLoadingDomains || isLoadingLatestRevision;

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof deployFormSchema>) => {
      if (values.revision) {
        onSubmit?.(undefined, values);
      } else {
        onSubmit?.(undefined, { ...values, revision: 0 });
      }
    },
    [onSubmit]
  );

  const handleChangeDomain = useCallback(
    (currentDomain: string) => {
      const domainSelected = domains.find(domain => domain.domain === currentDomain);
      form.formMethods.setValue('revision', domainSelected?.revision ?? 0);
    },
    [domains, form.formMethods]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="w-125 gap-4">
      <Form.Body>
        <Form.Select name="environment" label="Environment" size="sm">
          <option value="main">Main</option>
          <option value="development">Development</option>
          <option value="staging">Staging</option>
          <option value="live">Live</option>
        </Form.Select>
        {!loading && watchEnvironment !== 'main' && !latestRevision && (
          <Alert className="text-white" intent="warning" size="sm">
            This environment don&apos;t have any snapshot, please make a snapshot first
          </Alert>
        )}
        {!loading && watchEnvironment === 'main' && (
          <Alert className="text-white" intent="info" size="sm">
            <span className="font-bold">Note:</span> Selecting <span className="inline font-bold">Main</span> will
            render all changes, Use this only for testing purposes
          </Alert>
        )}
        {(latestRevision > 0 || watchEnvironment === 'main') && (
          <Form.Select
            name="domain"
            label="Domain"
            placeholder="Domain..."
            size="sm"
            disabled={loading}
            onChange={handleChangeDomain}
          >
            {domains.map(domain => (
              <option key={domain.domain} value={domain.domain} disabled={!domain.isVerified}>
                {`${domain.domain}${domain.isVerified ? '' : ' [Unverified]'}`}
              </option>
            ))}
          </Form.Select>
        )}
        {latestRevision > 0 && watchDomain && (
          <Form.Select
            name="revision"
            label="Revision"
            placeholder="Revision Not Selected"
            size="sm"
            disabled={loading}
          >
            {Array(latestRevision)
              .fill(undefined)
              .map((_item, i) => (
                <option key={latestRevision - i} value={latestRevision - i}>
                  Revision {latestRevision - i}
                  {i === 0 && ' [Latest]'}
                  {domainSelected &&
                    domainSelected.revision === i + 1 &&
                    domainSelected.environment === watchEnvironment &&
                    ' [Published]'}
                </option>
              ))}
          </Form.Select>
        )}
      </Form.Body>
      <Form.Footer justify="end">
        <Button onClick={onClose} size="sm">
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={loading}>
          Publish
        </Button>
      </Form.Footer>
    </Form>
  );
};

export default DeployForm;
