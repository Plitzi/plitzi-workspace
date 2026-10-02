import Alert from '@plitzi/plitzi-ui/Alert';
import Badge from '@plitzi/plitzi-ui/Badge';
import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import Select from '@plitzi/plitzi-ui/Select';
import { use, useCallback, useState } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import ViewSection from '@pmodules/App/components/ViewSection';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import type { BuilderMutationsMap, BuilderQueriesMap } from '@plitzi/sdk-shared';
import type { BuilderNetworkContextValue } from '@plitzi/sdk-shared/network/NetworkContext';

export type VisitorGrantsProps = {
  /** The roles the space declares, which are the only ones that can be given. */
  roles: string[];
};

const messageOf = (error: string | Error | undefined): string =>
  (error instanceof Error ? error.message : error) || 'The role could not be given.';

/**
 * Who holds which of the space's visitor roles, given by email.
 *
 * Nobody needs an account yet: a role given to an address waits until somebody signs in with it — verified — and is
 * theirs from then on. Taking one back is immediate.
 */
const VisitorGrants = ({ roles }: VisitorGrantsProps) => {
  const { mutate: mutateNetwork } = use(NetworkContext) as BuilderNetworkContextValue<
    BuilderQueriesMap,
    BuilderMutationsMap
  >;
  const { data = [], isLoading, mutate } = useGraphQL('SpaceVisitors', data => data?.SpaceVisitors);
  const { showDialog } = useModal();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [problem, setProblem] = useState('');
  const chosenRole = roles.includes(role) ? role : (roles[0] ?? '');

  const handleAdd = useCallback(async () => {
    const response = await mutateNetwork('SpaceAddVisitor', { email: email.trim(), role: chosenRole });
    if (!response.success) {
      setProblem(messageOf(response.error));

      return;
    }

    setProblem('');
    setEmail('');
    await mutate();
  }, [chosenRole, email, mutate, mutateNetwork]);

  const handleRemove = useCallback(
    (id: number, address: string, held: string) => async () => {
      const confirmed = await showDialog(
        <Modal.Header>
          <h4>Take the role back</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="px-3 py-2">
            <h4>
              {address} will stop being {held} here, on their next request. Take it back?
            </h4>
          </div>
        </Modal.Body>
      );
      if (!confirmed) {
        return;
      }

      const response = await mutateNetwork('SpaceRemoveVisitor', { id });
      if (response.success) {
        await mutate();
      }
    },
    [mutate, mutateNetwork, showDialog]
  );

  return (
    <ViewSection title="People">
      {roles.length === 0 && (
        <span className="text-xs text-gray-500 dark:text-zinc-400">Declare a role above to give it to somebody.</span>
      )}
      {roles.length > 0 && (
        <div className="flex items-end gap-2">
          <Input
            size="sm"
            className="grow"
            name="visitorEmail"
            type="email"
            value={email}
            onChange={setEmail}
            label="Email"
            placeholder="ada@example.com"
          />
          <Select size="sm" name="visitorRole" value={chosenRole} onChange={setRole} label="Role">
            {roles.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <Button size="sm" onClick={handleAdd}>
            Give role
          </Button>
        </div>
      )}
      {problem && (
        <Alert intent="error" size="xs" solid={false}>
          {problem}
        </Alert>
      )}
      {isLoading && <div className="text-sm text-gray-500">Loading…</div>}
      {data.map(grant => (
        <div
          key={grant.id}
          className="flex items-center justify-between gap-2 rounded-sm border border-gray-200 px-3 py-2 dark:border-zinc-700"
        >
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm">{grant.email}</span>
            <span className="text-xs text-gray-500 dark:text-zinc-400">{grant.role}</span>
          </div>
          <div className="flex items-center gap-2">
            {grant.claimed && (
              <Badge intent="success" size="xs" solid={false}>
                Signed in
              </Badge>
            )}
            {!grant.claimed && (
              <Badge intent="warning" size="xs" solid={false}>
                Waiting for sign-in
              </Badge>
            )}
            <Button size="sm" intent="danger" onClick={handleRemove(grant.id, grant.email, grant.role)}>
              Remove
            </Button>
          </div>
        </div>
      ))}
    </ViewSection>
  );
};

export default VisitorGrants;
