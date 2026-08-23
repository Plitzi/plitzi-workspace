import Alert from '@plitzi/plitzi-ui/Alert';
import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useMemo, useState } from 'react';

import { validateActionDocument } from '@plitzi/sdk-shared/actions';

import Workflow from '../../../Interactions/components/Workflow';
import ActionCheck from '../ActionCheck';
import ActionEvents from '../ActionEvents';
import ActionTestRun from '../ActionTestRun';
import ActionWebhookUrl from '../ActionWebhookUrl';

import type {
  ActionRunReport,
  ActionDocument,
  ActionField,
  ActionTaskDescriptor,
  ActionTriggerType,
  ElementInteraction,
  InteractionCallback,
  InteractionCallbackParam,
  SpaceAction,
  SpaceCredential
} from '@plitzi/sdk-shared';

export type ActionFormProps = {
  action?: SpaceAction;
  tasks: ActionTaskDescriptor[];
  credentials: SpaceCredential[];
  deployments: { environment: string; domain: string; isDefault: boolean }[];
  onRun: (
    identifier: string,
    input: Record<string, unknown>,
    trigger: ActionTriggerType
  ) => Promise<ActionRunReport | undefined>;
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

type TriggerParams = Record<string, InteractionCallbackParam>;

const callerParams: TriggerParams = {
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

const signatureParams = (credentials: SpaceCredential[]): TriggerParams => ({
  signatureCredential: {
    type: 'select',
    defaultValue: '',
    label: credentials.length > 0 ? 'Signing secret' : 'Signing secret — add one in Credentials first',
    canBind: false,
    options: credentials.map(credential => ({
      label: `${credential.name} (${credential.identifier})`,
      value: credential.identifier
    }))
  },
  signatureHeader: {
    type: 'select',
    defaultValue: 'x-signature',
    label: 'Header the signature arrives in',
    canBind: false,
    options: [
      { label: 'x-signature (the default)', value: 'x-signature' },
      { label: 'x-hub-signature-256 — GitHub', value: 'x-hub-signature-256' },
      { label: 'x-shopify-hmac-sha256 — Shopify', value: 'x-shopify-hmac-sha256' }
    ],
    when: params => Boolean(params.signatureCredential)
  },
  signatureAlgorithm: {
    type: 'select',
    defaultValue: 'sha256',
    label: 'Algorithm',
    canBind: false,
    options: [
      { label: 'SHA-256 (almost always this)', value: 'sha256' },
      { label: 'SHA-1', value: 'sha1' }
    ],
    when: params => Boolean(params.signatureCredential)
  },
  signatureSecretField: {
    type: 'text',
    defaultValue: '',
    label: 'Which key of that credential holds the secret — blank means secret',
    canBind: false,
    when: params => Boolean(params.signatureCredential)
  },
  signatureTimestampHeader: {
    type: 'text',
    defaultValue: '',
    label: 'Only if the sender puts the signing time in its own header',
    canBind: false,
    when: params => Boolean(params.signatureCredential)
  },
  // Only once there is a timestamp to compare against: without one, a signature never gets old.
  signatureToleranceSeconds: {
    type: 'text',
    defaultValue: '',
    label: 'Reject deliveries signed more than N seconds ago',
    canBind: false,
    when: params => Boolean(params.signatureCredential) && Boolean(params.signatureTimestampHeader)
  }
});

const triggerParamsFor = (credentials: SpaceCredential[]): Record<string, TriggerParams> => ({
  call: callerParams,
  render: {
    ...callerParams,
    cacheSeconds: {
      type: 'text',
      defaultValue: '',
      label: 'Reuse the answer for (seconds)',
      canBind: false
    }
  },
  webhook: { ...callerParams, ...signatureParams(credentials) },
  schedule: {
    cron: { type: 'text', defaultValue: '0 * * * *', label: 'Cron (UTC)', canBind: false },
    timezone: { type: 'text', defaultValue: '', label: 'Timezone', canBind: false }
  }
});

const asNodeDefinitions = (tasks: ActionTaskDescriptor[], credentials: SpaceCredential[]): InteractionCallback[] => {
  const triggerParams = triggerParamsFor(credentials);

  return [
    ...Object.keys(TRIGGER_TITLES).map(kind => ({
      action: kind,
      title: TRIGGER_TITLES[kind],
      type: 'trigger' as const,
      params: triggerParams[kind],
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
};

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

const ActionForm = ({ action, tasks, credentials, deployments, onRun, onSubmit, onCancel }: ActionFormProps) => {
  const [name, setName] = useState(action?.name ?? '');
  const [document, setDocument] = useState<ActionDocument>(() => action?.document ?? emptyDocument());
  const [isSaving, setIsSaving] = useState(false);

  const nodeDefinitions = useMemo(() => asNodeDefinitions(tasks, credentials), [tasks, credentials]);
  const report = useMemo(() => validateActionDocument({ ...document, name: name || document.name }), [document, name]);
  // Read off the flow as it is being edited: the URL is worth showing the moment somebody adds the way in.
  const hasWebhook = useMemo(
    () => Object.values(document.nodes).some(node => node.type === 'trigger' && node.action === 'webhook'),
    [document]
  );

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
    (input: Record<string, unknown>, trigger: ActionTriggerType) => onRun(action?.identifier ?? '', input, trigger),
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

      {/* A webhook has an address, and it is the one thing about it an author cannot work out from the flow. It
          shows as soon as the trigger exists — before saving, because the identifier is what it is built from. */}
      {action && hasWebhook && <ActionWebhookUrl identifier={action.identifier} deployments={deployments} />}

      {/* Before running anything: what this server can already tell is wrong. It is the half the editor cannot
          see, and the half that otherwise surfaces on somebody else's first delivery. */}
      {action && <ActionCheck actionId={action.identifier} />}

      {action && (
        <ActionTestRun
          document={action.document}
          disabled={false}
          disabledReason="Runs the saved version, not the edits above."
          onRun={handleRun}
        />
      )}

      {/* The other half of the same question: the test run says what happens when the author presses a button,
          this says what happened when nobody was watching. */}
      {action && <ActionEvents actionId={action.identifier} />}

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
