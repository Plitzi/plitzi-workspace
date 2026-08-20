import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, useMemo, useState } from 'react';

import { validateActionDocument } from '@plitzi/sdk-shared/actions';

import Workflow from '../../../Interactions/components/Workflow';
import ActionFields from '../ActionFields';
import ActionResources from '../ActionResources';
import ActionTestRun from '../ActionTestRun';

import type {
  ActionAccess,
  ActionRunReport,
  ActionDocument,
  ActionField,
  ActionTaskDescriptor,
  ActionTrigger,
  ElementInteraction,
  InteractionCallback,
  SpaceAction
} from '@plitzi/sdk-shared';

export type ActionFormProps = {
  action?: SpaceAction;
  tasks: ActionTaskDescriptor[];
  onRun: (identifier: string, input: Record<string, unknown>) => Promise<ActionRunReport | undefined>;
  onSubmit: (name: string, document: ActionDocument, enabled: boolean) => Promise<void> | void;
  onCancel: () => void;
};

const TRIGGER_TYPES: ActionTrigger['type'][] = ['call', 'webhook', 'schedule', 'render'];

const emptyDocument = (): ActionDocument => ({
  name: '',
  enabled: true,
  access: { mode: 'session' },
  triggers: [{ type: 'call' }],
  input: {},
  output: {},
  nodes: {}
});

/**
 * The catalog, in the shape the flow editor already draws.
 *
 * `Workflow` renders `InteractionCallback`s, which is what makes this reuse possible at all: a server task and a
 * client callback declare their parameters the same way, so the editor an author already knows is the editor they
 * get here — with a different set of steps in it.
 */
const asNodeDefinitions = (tasks: ActionTaskDescriptor[]): InteractionCallback[] =>
  tasks.map(task => ({
    action: task.name,
    title: task.title,
    type: 'task',
    params: task.params as InteractionCallback['params'],
    preview: {}
  }));

const ActionForm = ({ action, tasks, onRun, onSubmit, onCancel }: ActionFormProps) => {
  const [name, setName] = useState(action?.name ?? '');
  const [enabled, setEnabled] = useState(action?.enabled ?? true);
  const [document, setDocument] = useState<ActionDocument>(() => action?.document ?? emptyDocument());
  const [isSaving, setIsSaving] = useState(false);

  const nodeDefinitions = useMemo(() => asNodeDefinitions(tasks), [tasks]);
  const report = useMemo(() => validateActionDocument({ ...document, name: name || document.name }), [document, name]);

  const patch = useCallback(
    (changes: Partial<ActionDocument>) => setDocument(current => ({ ...current, ...changes })),
    []
  );

  const handleChangeAccess = useCallback(
    (value: string) => {
      const mode = value as ActionAccess['mode'];
      patch({ access: mode === 'role' ? { mode, permissions: [] } : { mode } });
    },
    [patch]
  );

  const handleChangePermissions = useCallback(
    (value: string) =>
      patch({
        access: {
          mode: 'role',
          permissions: value
            .split(',')
            .map(item => item.trim())
            .filter(Boolean)
        }
      }),
    [patch]
  );

  const handleToggleTrigger = useCallback(
    (type: ActionTrigger['type']) => () => {
      const current = document.triggers;
      const has = current.some(trigger => trigger.type === type);
      const next = has
        ? current.filter(trigger => trigger.type !== type)
        : [...current, (type === 'schedule' ? { type, cron: '0 * * * *' } : { type }) as ActionTrigger];
      patch({ triggers: next });
    },
    [document.triggers, patch]
  );

  const handleChangeCron = useCallback(
    (value: string) =>
      patch({
        triggers: document.triggers.map(trigger =>
          trigger.type === 'schedule' ? { ...trigger, cron: value } : trigger
        )
      }),
    [document.triggers, patch]
  );

  const handleChangeFields = useCallback(
    (key: 'input' | 'output') => (fields: Record<string, ActionField>) => patch({ [key]: fields }),
    [patch]
  );

  const handleChangeNodes = useCallback((nodes: Record<string, ElementInteraction>) => patch({ nodes }), [patch]);

  const handleRun = useCallback(
    (input: Record<string, unknown>) => onRun(action?.identifier ?? '', input),
    [action, onRun]
  );

  const handleSubmit = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSubmit(name, { ...document, name, enabled }, enabled);
    } finally {
      setIsSaving(false);
    }
  }, [name, document, enabled, onSubmit]);

  const schedule = document.triggers.find(trigger => trigger.type === 'schedule');
  const permissions = document.access.mode === 'role' ? document.access.permissions.join(', ') : '';

  return (
    <div className="mx-auto flex w-full max-w-4xl grow basis-0 flex-col gap-4 overflow-auto p-4">
      <div className="flex items-end gap-2">
        <Input value={name} label="Name" size="xs" placeholder="Send quote" onChange={setName} />
        <Select value={enabled ? 'on' : 'off'} label="State" size="xs" onChange={value => setEnabled(value === 'on')}>
          <option value="on">Enabled</option>
          <option value="off">Disabled</option>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Who may run it</span>
        <Select value={document.access.mode} size="xs" onChange={handleChangeAccess}>
          <option value="session">Signed-in visitors</option>
          <option value="role">Visitors with permissions</option>
          <option value="public">Anyone</option>
        </Select>
        {document.access.mode === 'role' && (
          <Input
            value={permissions}
            label="Permissions"
            size="xs"
            placeholder="spaceManage, orders.write"
            onChange={handleChangePermissions}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">What starts it</span>
        <div className="flex flex-wrap gap-2">
          {TRIGGER_TYPES.map(type => {
            const active = document.triggers.some(trigger => trigger.type === type);

            return (
              <Button
                key={type}
                size="xs"
                intent={active ? 'primary' : 'secondary'}
                onClick={handleToggleTrigger(type)}
              >
                {type}
              </Button>
            );
          })}
        </div>
        {schedule?.type === 'schedule' && (
          <Input value={schedule.cron} label="Cron" size="xs" placeholder="0 * * * *" onChange={handleChangeCron} />
        )}
      </div>

      <ActionFields
        label="Input"
        hint="What the caller may send. Anything not declared here is dropped before the flow runs."
        fields={document.input}
        onChange={handleChangeFields('input')}
      />
      <ActionFields
        label="Output"
        hint="The only values the caller gets back. Everything else a step produced stays on the server."
        fields={document.output}
        onChange={handleChangeFields('output')}
      />

      <ActionResources
        credentials={document.credentials ?? []}
        connectors={document.connectors ?? []}
        onChange={patch}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">The flow</span>
        <Workflow
          nodes={document.nodes}
          nodeDefinitions={nodeDefinitions}
          triggerTitle="When this is called..."
          callbackTitle="The server does this..."
          onChange={handleChangeNodes}
        />
      </div>

      {report.errors.length > 0 && (
        <Alert intent="error" size="sm">
          <ul className="list-inside list-disc text-xs">
            {report.errors.map(issue => (
              <li key={`${issue.path}-${issue.message}`}>
                {issue.path ? `${issue.path}: ` : ''}
                {issue.message}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      {report.warnings.length > 0 && (
        <Alert intent="warning" size="sm">
          <ul className="list-inside list-disc text-xs">
            {report.warnings.map(issue => (
              <li key={`${issue.path}-${issue.message}`}>
                {issue.message}
                {issue.hint ? ` — ${issue.hint}` : ''}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {action && (
        <ActionTestRun
          input={document.input}
          disabled={false}
          disabledReason="Runs the saved version, not the edits above."
          onRun={handleRun}
        />
      )}

      <div className="flex justify-end gap-2">
        <Button size="sm" intent="secondary" onClick={onCancel}>
          Cancel
        </Button>
        {/* Saving an invalid document would store a flow the runner refuses at request time, which is a failure
            nobody sees until a visitor clicks. */}
        <Button size="sm" disabled={isSaving || !report.valid || !name} onClick={handleSubmit}>
          {action ? 'Save' : 'Create'}
        </Button>
      </div>
    </div>
  );
};

export default ActionForm;
