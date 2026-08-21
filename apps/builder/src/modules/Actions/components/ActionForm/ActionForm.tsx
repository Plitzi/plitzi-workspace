import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useMemo, useState } from 'react';

import { triggerInput, validateActionDocument } from '@plitzi/sdk-shared/actions';

import Workflow from '../../../Interactions/components/Workflow';
import ActionTestRun from '../ActionTestRun';

import type {
  ActionRunReport,
  ActionDocument,
  ActionField,
  ActionTaskDescriptor,
  ElementInteraction,
  InteractionCallback,
  SpaceAction
} from '@plitzi/sdk-shared';

export type ActionFormProps = {
  action?: SpaceAction;
  tasks: ActionTaskDescriptor[];
  onRun: (identifier: string, input: Record<string, unknown>) => Promise<ActionRunReport | undefined>;
  onSubmit: (name: string, document: ActionDocument) => Promise<void> | void;
  onCancel: () => void;
};

const emptyDocument = (): ActionDocument => ({ name: '', nodes: {} });

const TRIGGER_TITLES: Record<string, string> = {
  call: 'When a page calls it',
  webhook: 'When a webhook arrives',
  schedule: 'On a schedule',
  render: 'While a page renders'
};

const ACCESS_OPTIONS = [
  { label: 'Signed-in visitors', value: 'session' },
  { label: 'Visitors with permissions', value: 'role' },
  { label: 'Anyone, signed out included', value: 'public' }
];

/**
 * What a way in carries, on the step that IS that way in.
 *
 * A schedule has none of it: a clock is not a caller, so there is nobody to authorize and nothing to send.
 */
const callerParams: InteractionCallback['params'] = {
  access: { type: 'select', defaultValue: 'session', label: 'Who may', canBind: false, options: ACCESS_OPTIONS },
  permissions: {
    type: 'text',
    defaultValue: '',
    label: 'Permissions (comma separated)',
    canBind: false,
    when: params => params.access === 'role'
  },
  input: { type: 'codemirror-json', defaultValue: '{}', label: 'Input it accepts', canBind: false }
};

const TRIGGER_PARAMS: Record<string, InteractionCallback['params']> = {
  call: callerParams,
  render: callerParams,
  webhook: {
    ...callerParams,
    verify: {
      type: 'codemirror-json',
      defaultValue: '{"type":"hmac","header":"x-signature","algorithm":"sha256","credential":""}',
      label: 'Signature check',
      canBind: false
    }
  },
  schedule: {
    cron: { type: 'text', defaultValue: '0 * * * *', label: 'Cron (UTC)', canBind: false },
    timezone: { type: 'text', defaultValue: '', label: 'Timezone', canBind: false }
  }
};

/**
 * The catalog, in the shape the flow editor already draws.
 *
 * `Workflow` renders `InteractionCallback`s, which is what makes this reuse possible at all: a server task and a
 * client callback declare their parameters the same way, so the editor an author already knows is the editor they
 * get here — with a different set of steps in it.
 *
 * The TRIGGERS declare parameters too, and that is the whole of authoring a way in: pick one, say who may use it
 * and what it takes, chain the tasks. There is no panel above the flow repeating any of it — there was, and it
 * left the same trigger configurable in two places that could disagree.
 */
const asNodeDefinitions = (tasks: ActionTaskDescriptor[]): InteractionCallback[] => [
  ...Object.keys(TRIGGER_TITLES).map(kind => ({
    action: kind,
    title: TRIGGER_TITLES[kind],
    type: 'trigger' as const,
    params: TRIGGER_PARAMS[kind],
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
  const [document, setDocument] = useState<ActionDocument>(() => action?.document ?? emptyDocument());
  const [isSaving, setIsSaving] = useState(false);

  const nodeDefinitions = useMemo(() => asNodeDefinitions(tasks), [tasks]);
  const report = useMemo(() => validateActionDocument({ ...document, name: name || document.name }), [document, name]);

  const patch = useCallback(
    (changes: Partial<ActionDocument>) => setDocument(current => ({ ...current, ...changes })),
    []
  );

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
      await onSubmit(name, { ...document, name });
    } finally {
      setIsSaving(false);
    }
  }, [name, document, onSubmit]);

  // The `call` trigger's own contract: what a test run asks for is what a page would send.
  const callTrigger = Object.values(document.nodes).find(node => node.type === 'trigger' && node.action === 'call');
  const callInput = callTrigger ? triggerInput(callTrigger.params) : {};

  return (
    <div className="mx-auto flex w-full max-w-4xl grow basis-0 flex-col gap-4 overflow-auto p-4">
      <Input value={name} label="Name" size="xs" placeholder="Send quote" onChange={setName} />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">The flow</span>
        <Workflow
          nodes={document.nodes}
          nodeDefinitions={nodeDefinitions}
          stepType="task"
          defaultTrigger="call"
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
          input={callInput}
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
