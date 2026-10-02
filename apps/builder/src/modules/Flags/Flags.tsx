import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { use, useCallback, useMemo, useState } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';

import FlagForm from './components/FlagForm';
import FlagItem from './components/FlagItem';
import PublishFlagsForm from './components/PublishFlagsForm';
import { flagRuleFields } from './helpers/flagRuleFields';

import type { PublishFlagsValues } from './components/PublishFlagsForm';
import type { BuilderMutationsMap, BuilderQueriesMap, SchemaFlag } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';

const NONE: Record<string, boolean> = {};

/**
 * The space's feature flags: declared and ruled here, previewed in the canvas, and published on their own.
 *
 * Forcing one here is the canvas's `qa` layer — what the author looks at, never saved. Flags are not part of a
 * snapshot: each environment has one set, shared by every revision it serves, and publishing them switches what the
 * environment serves now without shipping whatever else the draft holds.
 */
const Flags = () => {
  const { showDialog, showModal } = useModal();
  const { addToast } = useToast();
  const { builderHandler } = use(BuilderContext);
  const { mutate } = use(NetworkContext) as BuilderNetworkContextValue<BuilderQueriesMap, BuilderMutationsMap>;
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [[declared, resolved, routeParams = {}, queryParams = {}, visitorRoles]] = useBuilderStore([
    'schema.flags',
    'flags.resolved',
    'navigation.routeParams',
    'navigation.queryParams',
    'schema.settings.visitorRoles'
  ]);
  const [forced = NONE, setForced] = useBuilderStore('flags.overrides.qa');
  const fields = useMemo(
    () => flagRuleFields({ routeParams, queryParams, visitorRoles: Object.keys(visitorRoles ?? {}) }),
    [routeParams, queryParams, visitorRoles]
  );
  const names = useMemo(
    () => Object.keys(declared ?? {}).filter(name => name.toLowerCase().includes(filter.toLowerCase())),
    [declared, filter]
  );

  const handleSet = useCallback(
    (name: string, flag: SchemaFlag) => {
      builderHandler('schemaSetFlag', name, flag);
      setAdding(false);
    },
    [builderHandler]
  );

  const handleRemove = useCallback(
    async (name: string) => {
      const confirmed = await showDialog(
        <Modal.Header>
          <h4>Remove Feature Flag</h4>
        </Modal.Header>,
        <Modal.Body>
          <p>
            Elements gated on <b>{name}</b> will not be rendered until it is declared again.
          </p>
        </Modal.Body>,
        undefined,
        { size: 'sm' },
        name
      );

      if (confirmed) {
        builderHandler('schemaRemoveFlag', name);
      }
    },
    [builderHandler, showDialog]
  );

  const handleForce = useCallback(
    (name: string, value: boolean | undefined) => {
      const { [name]: _previous, ...rest } = forced;
      setForced(value === undefined ? rest : { ...rest, [name]: value });
    },
    [forced, setForced]
  );

  const handleAdd = useCallback(() => setAdding(true), []);
  const handleCancelAdd = useCallback(() => setAdding(false), []);

  const handlePublish = useCallback(async () => {
    const values = await showModal<PublishFlagsValues>(
      <Modal.Header>
        <h4>Publish Flags</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <PublishFlagsForm onClose={onClose} onSubmit={onSubmit} />
        </Modal.Body>
      )
    );

    if (!values) {
      return;
    }

    const { result, error } = await mutate('SpacePublishFlags', values, true);
    if (result) {
      addToast(
        <div>
          Flags published to <b>{result.environment}</b>
        </div>,
        { appeareance: 'success', autoDismiss: true, placement: 'top-right' }
      );
    } else if (error) {
      addToast(error instanceof Error ? error.message : error, {
        appeareance: 'error',
        autoDismiss: true,
        placement: 'top-right'
      });
    }
  }, [addToast, mutate, showModal]);

  return (
    <div className="flex h-full w-full flex-col gap-2 p-2">
      <Alert intent="info" size="sm" solid={false}>
        Flags are kept apart from the space's snapshots. Each environment has one set, used by every snapshot it serves:
        rolling a snapshot back keeps its flags, and Publish flags changes them without a new snapshot. A snapshot only
        keeps a copy, as a fallback for when the environment's flags cannot be read.
      </Alert>
      <div className="flex items-center gap-2">
        <Input className="grow" placeholder="Search Flags" size="xs" value={filter} onChange={setFilter}>
          <Input.Icon icon="fa-solid fa-magnifying-glass" />
        </Input>
        <Button size="xs" title="Publish the draft's flags to an environment" onClick={handlePublish}>
          <Button.Icon icon="fa-solid fa-rocket" />
        </Button>
      </div>
      <div className="flex min-h-0 grow basis-0 flex-col gap-1 overflow-y-auto">
        {names.length === 0 && !adding && (
          <div className="py-4 text-center text-xs text-zinc-400 italic dark:text-zinc-500">No feature flags yet</div>
        )}
        {declared &&
          names.map(name => (
            <FlagItem
              key={name}
              name={name}
              flag={declared[name]}
              resolution={resolved?.[name]}
              forced={forced[name]}
              fields={fields}
              onUpdate={handleSet}
              onRemove={handleRemove}
              onForce={handleForce}
            />
          ))}
      </div>
      {adding && (
        <FlagForm
          isNewRecord
          takenNames={Object.keys(declared ?? {})}
          fields={fields}
          onSubmit={handleSet}
          onClose={handleCancelAdd}
        />
      )}
      {!adding && (
        <Button className="w-full" size="xs" onClick={handleAdd} iconPlacement="before">
          <Button.Icon icon="fa-solid fa-plus" />
          Add Feature Flag
        </Button>
      )}
    </div>
  );
};

export default Flags;
