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
  nodes: {}
});

/**
 * The catalog, in the shape the flow editor already draws.
 *
 * `Workflow` renders `InteractionCallback`s, which is what makes this reuse possible at all: a server task and a
 * client callback declare their parameters the same way, so the editor an author already knows is the editor they
 * get here — with a different set of steps in it.
 */
const asNodeDefinitions = (tasks: ActionTaskDescriptor[], triggers: ActionTrigger['type'][]): InteractionCallback[] => [
  // The entry step picks from the triggers this action declares above, so the flow can only start the ways the
  // document says it can.
  ...triggers.map(type => ({
    action: type,
    title: TRIGGER_TITLES[type],
    type: 'trigger' as const,
    params: {},
    preview: {}
  })),
  ...tasks.map(task => ({
    action: task.name,
    title: task.title,
    type: 'task' as const,
    params: task.params as InteractionCallback['params'],
    preview: {}
  }))
];

const TRIGGER_TITLES: Record<string, string> = {
  call: 'When a page calls it',
  webhook: 'When a webhook arrives',
  schedule: 'On a schedule',
  render: 'While a page renders',
  custom: 'When the server raises it'
};

/**
 * The field list a binding editor offers on this action's result, read off the output step.
 *
 * Derived, never authored: the step is the contract, and a second list beside it is a second thing to keep in
 * step. Types are what the step's own JSON says — a token in quotes is text, an unquoted one keeps its type.
 */
const deriveOutput = (nodes: Record<string, ElementInteraction>): Record<string, ActionField> => {
  const step = Object.values(nodes)
    .filter(node => node.action === 'flow.output')
    .at(-1);
  const raw = step?.params.values;
  if (typeof raw !== 'string') {
    return {};
  }

  try {
    // Parsed with the tokens still in place: what matters here are the KEYS and whether each value was quoted.
    const parsed = JSON.parse(raw.replace(/\{\{[^}]*\}\}/g, '0')) as Record<string, unknown>;

    return Object.entries(parsed).reduce<Record<string, ActionField>>((acum, [key, value]) => {
      acum[key] = { type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'text' };

      return acum;
    }, {});
  } catch {
    return {};
  }
};

const ActionForm = ({ action, tasks, onRun, onSubmit, onCancel }: ActionFormProps) => {
  const [name, setName] = useState(action?.name ?? '');
  const [enabled, setEnabled] = useState(action?.enabled ?? true);
  const [document, setDocument] = useState<ActionDocument>(() => action?.document ?? emptyDocument());
  const [isSaving, setIsSaving] = useState(false);

  const nodeDefinitions = useMemo(
    () =>
      asNodeDefinitions(
        tasks,
        document.triggers.map(trigger => trigger.type)
      ),
    [tasks, document.triggers]
  );
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

  const handleChangeInput = useCallback((fields: Record<string, ActionField>) => patch({ input: fields }), [patch]);

  // The derived output travels with the flow, so the two can never disagree: one edit, one write.
  const handleChangeNodes = useCallback(
    (nodes: Record<string, ElementInteraction>) => patch({ nodes, output: deriveOutput(nodes) }),
    [patch]
  );

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
        onChange={handleChangeInput}
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
          stepType="task"
          triggerTitle="When this happens..."
          callbackTitle="The server does this..."
          onChange={handleChangeNodes}
        />
        <span className="text-xs text-gray-500">
          End with an <b>Output</b> step naming what the caller gets back — that step is the contract, and only the last
          one that runs is answered.
        </span>
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
