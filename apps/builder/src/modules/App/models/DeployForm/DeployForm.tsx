import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm, useFormWatch } from '@plitzi/plitzi-ui/Form';
import Icon from '@plitzi/plitzi-ui/Icon';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';

import { formatFromNow } from '@plitzi/sdk-shared';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import InputEnvironment from './InputEnvironment';

import type { Environment } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export const deployFormSchema = z.object({
  environment: z.enum(['main', 'production', 'staging', 'development']),
  domain: z.string().min(3, 'Domain must have at least 3 characters'),
  revision: z.coerce.number().optional(),
  credentialIdentifier: z.string().optional()
});

export type DeployFormProps = {
  environment?: Environment;
  domain?: string;
  revision?: number;
  credentialIdentifier?: string;
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: z.infer<typeof deployFormSchema>) => void;
};

const DeployForm = ({
  environment = 'main',
  domain = '',
  revision = 0,
  credentialIdentifier = '',
  onClose,
  onSubmit
}: DeployFormProps) => {
  const { data: domains = [], isLoading: isLoadingDomains } = useGraphQL(
    'SpaceDeployments',
    data => data?.SpaceDeployments.edges,
    undefined,
    { revalidateOnMount: true }
  );
  const { data: credentials = [], isLoading: isLoadingCredentials } = useGraphQL(
    'SpaceCredentials',
    data => data?.SpaceCredentials.edges,
    { filter: { provider: { eq: 'ssr' } } }
  );

  const form = useForm({
    defaultValues: { environment, domain, revision, credentialIdentifier },
    config: { schema: deployFormSchema }
  });
  const watchEnvironment = useFormWatch(form.formMethods, 'environment');
  const watchDomain = useFormWatch(form.formMethods, 'domain');
  const { data: latestRevision, isLoading: isLoadingLatestRevision } = useGraphQL(
    'SpaceLatestRevision',
    data => data?.SpaceLatestRevision?.snapshot,
    { environment: watchEnvironment }
  );
  const domainSelected = useMemo(() => domains.find(domain => domain.domain === watchDomain), [domains, watchDomain]);
  const loading = isLoadingDomains || isLoadingLatestRevision || isLoadingCredentials;

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
      form.formMethods.setValue('credentialIdentifier', domainSelected?.credential?.identifier ?? '');
    },
    [domains, form.formMethods]
  );

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="w-125 gap-4">
      <Form.Body>
        <InputEnvironment />
        {watchEnvironment !== 'main' && !latestRevision && (
          <Alert intent="warning" size="sm" solid={false}>
            This environment don&apos;t have any snapshot, please make a snapshot first
          </Alert>
        )}
        {(latestRevision || watchEnvironment === 'main') && (
          <Form.Select
            name="domain"
            label={
              <div className="flex items-center gap-1">
                <Icon icon="fa-solid fa-globe" />
                Domain
              </div>
            }
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
        {(latestRevision || watchEnvironment === 'main') && watchDomain && (
          <Form.Select
            name="credentialIdentifier"
            label={
              <div className="flex items-center gap-1">
                <Icon icon="fa-solid fa-shield-halved" /> Credential
              </div>
            }
            placeholder="No Authentication"
            size="sm"
            disabled={loading}
          >
            {credentials.map(credential => (
              <option key={credential.identifier} value={credential.identifier}>
                {credential.name}
              </option>
            ))}
          </Form.Select>
        )}
        {latestRevision && watchDomain && (
          <div className="flex flex-col gap-0.5">
            <Form.Select
              name="revision"
              label={
                <div className="flex items-center gap-1">
                  <Icon icon="fa-solid fa-code-branch" /> Revision
                </div>
              }
              placeholder="Revision Not Selected"
              size="sm"
              disabled={loading}
            >
              {Array(latestRevision.revision)
                .fill(undefined)
                .map((_item, i) => (
                  <option key={latestRevision.revision - i} value={latestRevision.revision - i}>
                    Revision {latestRevision.revision - i}
                    {i === 0 && ' [Latest]'}
                    {domainSelected &&
                      domainSelected.revision === i + 1 &&
                      domainSelected.environment === watchEnvironment &&
                      ' [Published]'}
                  </option>
                ))}
            </Form.Select>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <div className="h-1 w-1 rounded-full bg-gray-500" />
              {`Last Revision Published ${formatFromNow(latestRevision.publishedAt, undefined, { addSuffix: true })}`}
            </div>
          </div>
        )}
      </Form.Body>
      <Form.Footer justify="end">
        <Button onClick={onClose} size="sm">
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={loading} iconPlacement="before">
          <Button.Icon icon="fa-brands fa-space-awesome" />
          Publish
        </Button>
      </Form.Footer>
    </Form>
  );
};

export default DeployForm;
