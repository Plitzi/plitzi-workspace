import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm, useFormWatch } from '@plitzi/plitzi-ui/Form';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { use, useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';
import type { QueriesMap } from '@pmodules/Network/Queries';
import type { Domain } from '@pmodules/Network/Queries/Space/SpaceDeploymentsQuery';
import type { MouseEvent } from 'react';

const deployFormSchema = z.object({
  environment: z.enum(['main', 'production', 'staging', 'development']),
  domain: z.string().min(3, 'Domain must have at least 3 characters'),
  revision: z.number().optional()
});

export type DeployFormProps = {
  environment?: 'main' | 'production' | 'staging' | 'development';
  domain?: string;
  revision?: number;
  onClose?: (e?: MouseEvent) => void;
  onSubmit?: (e: MouseEvent | undefined, values: z.infer<typeof deployFormSchema>) => void;
};

const DeployForm = ({ environment = 'main', domain = '', revision = 0, onClose, onSubmit }: DeployFormProps) => {
  const [loading, setLoading] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [latestRevision, setLatestRevision] = useState<number>(0);
  const { query } = use(NetworkContext) as BuilderNetworkContextValue<QueriesMap>;
  const { addToast } = useToast();

  const form = useForm({ defaultValues: { environment, domain, revision }, config: { schema: deployFormSchema } });
  const watchEnvironment = useFormWatch(form.formMethods, 'environment');
  const watchDomain = useFormWatch(form.formMethods, 'domain');
  const domainSelected = useMemo(() => domains.find(domain => domain.domain === watchDomain), [domains, watchDomain]);

  useEffect(() => {
    const getLatestRevision = async () => {
      setLoading(true);
      try {
        const response = await query('SpaceLatestRevision', { environment: watchEnvironment }, 'network-only');
        if (response.result && response.result.SpaceLatestRevision) {
          setLatestRevision(response.result.SpaceLatestRevision.snapshot.revision);
        } else {
          setLatestRevision(0);
        }
      } catch (e: unknown) {
        addToast((e as Error).message, { appeareance: 'error', autoDismiss: true, placement: 'top-right' });
      } finally {
        setLoading(false);
      }
    };

    form.formMethods.setValue('domain', '');
    if ((watchEnvironment as string) && watchEnvironment !== 'main') {
      void getLatestRevision();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchEnvironment]);

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

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const response = await query('SpaceDeployments', { pageSize: 30 }, 'network-only');
      if (response.result) {
        const { /* pageInfo, */ edges } = response.result.SpaceDeployments;
        setDomains(edges);
        // setHasNextPage(pageInfo.hasNextPage);
      }
    } catch {
      // Nothing
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  if (loading) {
    return (
      <div className="flex grow flex-col items-center justify-center p-20">
        <i className="fa-solid fa-sync fa-spin fa-4x" title="Loading" />
      </div>
    );
  }

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        <Form.Select name="environment" label="Environment" size="sm">
          <option value="main">Main</option>
          <option value="development">Development</option>
          <option value="staging">Staging</option>
          <option value="live">Live</option>
        </Form.Select>
        {watchEnvironment !== 'main' && !latestRevision && (
          <Alert className="mt-4 text-white" intent="warning">
            This environment don&apos;t have any snapshot, please make a snapshot first
          </Alert>
        )}
        {watchEnvironment === 'main' && (
          <Alert className="mt-4 text-white" intent="info">
            <span className="font-bold">Note:</span> Selecting <span className="inline font-bold">Main</span> will
            render all changes, Use this only for testing purposes
          </Alert>
        )}
        {(latestRevision > 0 || watchEnvironment === 'main') && (
          <Form.Select name="domain" label="Domain" placeholder="Domain...">
            {domains.map(domain => (
              <option key={domain.domain} value={domain.domain} disabled={!domain.isVerified}>
                {`https://${domain.domain}${!domain.isVerified ? '' : ' (Unverified)'}`}
              </option>
            ))}
          </Form.Select>
        )}
        {latestRevision > 0 && watchDomain && (
          <Form.Select name="revision" label="Revision" placeholder="Revision Not Selected">
            {Array(latestRevision)
              .fill(undefined)
              .map((_item, i) => (
                <option key={latestRevision - i} value={latestRevision - i}>
                  Revision {latestRevision - i}
                  {i === 0 && ' (Latest)'}
                  {domainSelected &&
                    domainSelected.revision === i + 1 &&
                    domainSelected.environment === watchEnvironment &&
                    ' (Published)'}
                </option>
              ))}
          </Form.Select>
        )}
      </Form.Body>
      <Form.Footer justify="end">
        <Button onClick={onClose} size="sm">
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Publish
        </Button>
      </Form.Footer>
    </Form>
  );
};

export default DeployForm;
