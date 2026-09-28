import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Heading from '@plitzi/plitzi-ui/Heading';
import Input from '@plitzi/plitzi-ui/Input';
import { use, useCallback, useState } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { checkVisitorRoles } from '@plitzi/sdk-shared/auth/visitorRoles';

import type { VisitorRoles as TVisitorRoles } from '@plitzi/sdk-shared/auth/visitorRoles';

export type VisitorRolesProps = {
  /** The roles the space declares (`settings.visitorRoles`), as the builder's document holds them. */
  roles: TVisitorRoles;
};

/** A comma-separated field, as the names it lists: trimmed, none empty. */
const parseNames = (text: string): string[] =>
  text
    .split(',')
    .map(name => name.trim())
    .filter(Boolean);

const textsOf = (roles: TVisitorRoles): Record<string, string> =>
  Object.fromEntries(Object.entries(roles).map(([role, permissions]) => [role, permissions.join(', ')]));

/**
 * The space's visitor roles and what each gives — the permissions an action's `access: 'role'` names.
 *
 * Saved as they are typed, and only when they are valid: a role the server would refuse is shown with what is wrong
 * instead of being sent, so the document never holds a half-written role that grants something by accident.
 */
const VisitorRoles = ({ roles }: VisitorRolesProps) => {
  const { eventBridge } = use(EventBridgeContext);
  // Each role's own text, so a comma being typed is not normalised away under the cursor.
  const [texts, setTexts] = useState<Record<string, string>>(() => textsOf(roles));
  const [newRole, setNewRole] = useState('');
  const [newPermissions, setNewPermissions] = useState('');
  const [problem, setProblem] = useState('');

  const save = useCallback(
    (next: Record<string, string>) => {
      setTexts(next);
      const declared = Object.fromEntries(Object.entries(next).map(([role, text]) => [role, parseNames(text)]));
      const checked = checkVisitorRoles(declared);
      if (!checked.ok) {
        setProblem(checked.problem);

        return false;
      }

      setProblem('');
      void eventBridge.emit('main', 'schemaUpdateSettings', checked.roles, 'visitorRoles');

      return true;
    },
    [eventBridge]
  );

  const handleChange = useCallback(
    (role: string) => (value: string) => save({ ...texts, [role]: value }),
    [save, texts]
  );

  const handleRemove = useCallback(
    (role: string) => () => {
      const { [role]: _removed, ...rest } = texts;
      save(rest);
    },
    [save, texts]
  );

  const handleAdd = useCallback(() => {
    const role = newRole.trim();
    if (!role) {
      setProblem('Name the role first, like "author".');

      return;
    }

    if (Object.hasOwn(texts, role)) {
      setProblem(`The space already has a role "${role}".`);

      return;
    }

    if (save({ ...texts, [role]: newPermissions })) {
      setNewRole('');
      setNewPermissions('');
    }
  }, [newPermissions, newRole, save, texts]);

  return (
    <div className="flex flex-col gap-3">
      <Heading as="h6">Roles</Heading>
      <span className="text-xs text-gray-500 dark:text-zinc-400">
        What a signed-in visitor may do here. An action asks for a permission (<code>access: role</code>); a role is the
        permissions it gives. Visitors hold only the permissions of the roles you give them below — never those of their
        Plitzi account.
      </span>
      {Object.entries(texts).map(([role, text]) => (
        <div key={role} className="flex items-end gap-2">
          <Input size="sm" className="grow" name={role} value={text} onChange={handleChange(role)} label={role} />
          <Button size="sm" intent="danger" onClick={handleRemove(role)}>
            Remove
          </Button>
        </div>
      ))}
      <div className="flex items-end gap-2">
        <Input size="sm" name="newRole" value={newRole} onChange={setNewRole} label="New role" placeholder="author" />
        <Input
          size="sm"
          className="grow"
          name="newPermissions"
          value={newPermissions}
          onChange={setNewPermissions}
          label="Permissions it gives, separated by commas"
          placeholder="postPublish, postEdit"
        />
        <Button size="sm" onClick={handleAdd}>
          Add role
        </Button>
      </div>
      {problem && (
        <Alert intent="error" size="xs" solid={false}>
          {problem}
        </Alert>
      )}
    </div>
  );
};

export default VisitorRoles;
