import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm, useFormWatch } from '@plitzi/plitzi-ui/Form';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { use, useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';

import NetworkContext from '@pmodules/Network/NetworkContext';

type Domain = {
  default: boolean;
  domain: string;
  environment: 'main' | 'production' | 'staging' | 'development';
  id: string;
  isVerified: boolean;
  revision: number | null;
};

const deployFormSchema = z.object({
  environment: z.enum(['main', 'production', 'staging', 'development']),
  domain: z.string().min(3, 'Domain must have at least 3 characters'),
  revision: z.number().optional()
});

export type DeployFormProps = {
  environment?: 'main' | 'production' | 'staging' | 'development';
  domain?: string;
  revision?: number;
  onClose?: () => void;
  onSubmit?: (values: z.infer<typeof deployFormSchema>) => void;
};

const DeployForm = ({ environment = 'main', domain = '', revision = 0, onClose, onSubmit }: DeployFormProps) => {
  const [loading, setLoading] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [latestRevision, setLatestRevision] = useState<number>(0);
  const { query } = use(NetworkContext);
  const { addToast } = useToast();

  const form = useForm({ initialValues: { environment, domain, revision }, config: { schema: deployFormSchema } });
  const watchEnvironment = useFormWatch(form.formMethods, 'environment');
  const watchDomain = useFormWatch(form.formMethods, 'domain');
  const domainSelected = useMemo(() => domains.find(domain => domain.domain === watchDomain), [domains, watchDomain]);

  useEffect(() => {
    const getLatestRevision = async () => {
      setLoading(true);
      const result = await query<{ snapshot: { revision: number } | null } | undefined>(
        'SpaceLatestRevision',
        { environment: watchEnvironment },
        'network-only'
      );
      setLoading(false);
      if (result && !(result instanceof Error) && result.snapshot) {
        setLatestRevision(result.snapshot.revision);
      } else if (result instanceof Error) {
        addToast(result.message, { appeareance: 'error', autoDismiss: true, placement: 'top-right' });
      } else {
        setLatestRevision(0);
      }
    };

    form.formMethods.setValue('domain', '');
    if (watchEnvironment) {
      void getLatestRevision();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchEnvironment]);

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof deployFormSchema>) => {
      if (values.revision) {
        onSubmit?.(values);
      } else {
        onSubmit?.({ ...values, revision: 0 });
      }
    },
    [onSubmit]
  );

  const fetch = useCallback(async () => {
    setLoading(true);
    const result = await query<{
      edges: Domain[];
      pageInfo: { hasPrevPage: boolean; hasNextPage: boolean; from: number; to: number; total: number };
    }>('SpaceDeployments', { pageSize: 30 }, 'network-only');
    if (!(result instanceof Error)) {
      const { /* pageInfo, */ edges } = result;
      setDomains(edges);
      // setHasNextPage(pageInfo.hasNextPage);
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
              .map((item, i) => (
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
