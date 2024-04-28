// Packages
import React, { use, useState, useEffect } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import { useForm, Controller } from 'react-hook-form';
import Button from '@plitzi/plitzi-ui-components/Button';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import Alert from '@plitzi/plitzi-ui-components/Alert';
import useToast from '@plitzi/plitzi-ui-components/Toast/useToast';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';

/**
 * @param {{
 *   className?: string;
 *   environment?: string;
 *   domain?: string;
 *   revision?: string;
 *   onClose?: () => void;
 *   onSubmit?: (values: { environment: string; domain: string; revision: string }) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DeployForm = props => {
  const { className = '', environment = 'main', domain = '', revision = '', onClose = noop, onSubmit = noop } = props;
  const [loading, setLoading] = useState(false);
  const [domains, setDomains] = useState([]);
  const [envSelected, setEnvSelected] = useState(environment);
  const [domainSelected, setDomainSelected] = useState(undefined);
  const [latestRevision, setLatestRevision] = useState(undefined);
  const { query } = use(NetworkContext);
  const { addToast } = useToast();

  const { control, handleSubmit, setValue } = useForm({ defaultValues: { environment, domain, revision } });

  const handleChangeEnvironment = onChangeForm => async e => {
    onChangeForm(e.target.value);
    setEnvSelected(e.target.value);
    setDomainSelected(undefined);
    setValue('domain', '');
    setLoading(true);
    const result = await query('SpaceLatestRevision', { environment: e.target.value }, 'network-only');
    setLoading(false);
    if (result && !(result instanceof Error) && result.snapshot) {
      setLatestRevision(result.snapshot.revision);
    } else if (result instanceof Error) {
      addToast(result.message, {
        appeareance: 'danger',
        autoDismiss: true,
        placement: 'top-right'
      });
    } else {
      setLatestRevision(null);
    }
  };

  const handleChangeRevision = onChangeForm => e => onChangeForm(parseInt(e.target.value, 10));

  const handleChangeDomain = onChangeForm => async e => {
    onChangeForm(e.target.value);
    setDomainSelected(domains.find(domain => domain.domain === e.target.value));
  };

  const handleSubmitInternal = values => {
    if (values.revision) {
      onSubmit(values);
    } else {
      onSubmit({ ...values, revision: null });
    }
  };

  const fetch = async () => {
    setLoading(true);
    const result = await query('SpaceDeployments', { pageSize: 30 }, 'network-only');
    if (!(result instanceof Error)) {
      const { /* pageInfo, */ edges } = result;
      setDomains(edges);
      // setHasNextPage(pageInfo.hasNextPage);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col grow items-center justify-center p-20">
        <i className="fa-solid fa-sync fa-spin fa-4x" title="Loading" />
      </div>
    );
  }

  return (
    <form className={classNames('flex flex-col p-3', className)} onSubmit={handleSubmit(handleSubmitInternal)}>
      <Controller
        control={control}
        rules={{ required: true }}
        name="environment"
        render={({ field: { onChange, value, name }, fieldState: { error } }) => (
          <FormControl
            type="select"
            name={name}
            size="md"
            label="Environment"
            className="w-full"
            inputClassName="rounded"
            onChange={handleChangeEnvironment(onChange)}
            value={value}
            error={error}
          >
            <option value="main">Main</option>
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="live">Live</option>
          </FormControl>
        )}
      />
      {!loading && envSelected !== 'main' && !latestRevision && (
        <Alert className="text-white mt-4" intent="warning">
          This environment don&apos;t have any snapshot, please make a snapshot first
        </Alert>
      )}
      {!loading && envSelected === 'main' && (
        <Alert className="text-white mt-4" intent="info">
          <span className="font-bold">Note:</span> Selecting <span className="font-bold inline">Main</span> will render
          all changes, Use this only for testing purposes
        </Alert>
      )}
      {latestRevision > 0 && (
        <Controller
          control={control}
          rules={{ required: false }}
          name="revision"
          render={({ field: { onChange, value, name }, fieldState: { error } }) => (
            <FormControl
              type="select"
              name={name}
              size="md"
              label="Revision"
              placeholder="Revision Not Selected"
              className="w-full mt-4"
              inputClassName="rounded"
              onChange={handleChangeRevision(onChange)}
              value={value}
              error={error}
            >
              {Array(latestRevision)
                .fill(undefined)
                .map((item, i) => (
                  <option key={latestRevision - i} value={latestRevision - i}>
                    Revision {latestRevision - i}
                    {i === 0 && ' (Latest)'}
                    {domainSelected &&
                      domainSelected.revision === i + 1 &&
                      domainSelected.environment === envSelected &&
                      ' (Published)'}
                  </option>
                ))}
            </FormControl>
          )}
        />
      )}
      {(latestRevision > 0 || envSelected === 'main') && (
        <Controller
          control={control}
          rules={{ required: true }}
          name="domain"
          render={({ field: { onChange, value, name }, fieldState: { error } }) => (
            <FormControl
              type="select"
              name={name}
              size="md"
              label="Domain"
              placeholder="Domain..."
              className="w-full mt-4"
              inputClassName="rounded"
              onChange={handleChangeDomain(onChange)}
              value={value}
              error={error}
            >
              {domains &&
                domains.map(domain => (
                  <option key={domain.domain} value={domain.domain} disabled={!domain.isVerified}>
                    {`https://${domain.domain}`}
                    {!domain.isVerified && ' (Unverified)'}
                  </option>
                ))}
            </FormControl>
          )}
        />
      )}
      <div className="flex justify-end mt-4">
        <Button onClick={onClose} className="mr-3 rounded-md">
          Cancel
        </Button>
        <Button type="submit" className="rounded-md" disabled={loading || domains.length === 0 || !domainSelected}>
          Publish!
        </Button>
      </div>
    </form>
  );
};

export default DeployForm;
