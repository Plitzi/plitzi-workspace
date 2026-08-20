import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import ActionFields from '../ActionFields';

import type { ActionAccess, ActionField, ActionTriggerParams, ActionTriggerType, ElementInteraction } from '@plitzi/sdk-shared';

export type ActionTriggersProps = {
  nodes: Record<string, ElementInteraction>;
  onChange: (nodes: Record<string, ElementInteraction>) => void;
};

const KINDS: ActionTriggerType[] = ['call', 'webhook', 'schedule', 'render'];

const TITLES: Record<string, string> = {
  call: 'When a page calls it',
  webhook: 'When a webhook arrives',
  schedule: 'On a schedule',
  render: 'While a page renders',
  custom: 'When the server raises it'
};

const blankTrigger = (kind: ActionTriggerType): ElementInteraction => ({
  id: `on-${kind}`,
  title: TITLES[kind],
  type: 'trigger',
  action: kind,
  // A schedule has no caller to authorize; everything else states its rule, because an unstated one is either a
  // lock-out or a hole.
  params: kind === 'schedule' ? { cron: '0 * * * *' } : { access: { mode: 'session' }, input: {} },
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId: `on-${kind}`,
  enabled: true
});

/**
 * The ways into an action, edited as what they are: the STEPS that start its flows.
 *
 * Everything here used to sit beside the flow as `triggers`, `access` and `input`, which meant one access rule for
 * every way in — a webhook forced its action to be public, and the page call that shared it went public too. On
 * the step, each entry point answers on its own terms.
 *
 * Adding one adds a trigger step to the node map, and the flow editor below picks up its chain from there.
 */
const ActionTriggers = ({ nodes, onChange }: ActionTriggersProps) => {
  const triggers = Object.entries(nodes).filter(([, node]) => node.type === 'trigger');

  const patchParams = useCallback(
    (key: string, changes: Partial<ActionTriggerParams>) => {
      const node = nodes[key];
      onChange({ ...nodes, [key]: { ...node, params: { ...(node.params as ActionTriggerParams), ...changes } } });
    },
    [nodes, onChange]
  );

  const handleToggle = useCallback(
    (kind: ActionTriggerType) => () => {
      const existing = triggers.find(([, node]) => node.action === kind);
      if (!existing) {
        const node = blankTrigger(kind);
        onChange({ ...nodes, [node.id]: node });

        return;
      }

      // Only the trigger goes: its steps stay, and the validator says they are unreachable rather than this
      // quietly deleting work somebody wrote.
      const rest = { ...nodes };
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete rest[existing[0]];

      onChange(rest);
    },
    [nodes, onChange, triggers]
  );

  const handleChangeAccess = useCallback(
    (key: string) => (value: string) => {
      const mode = value as ActionAccess['mode'];
      patchParams(key, { access: mode === 'role' ? { mode, permissions: [] } : { mode } });
    },
    [patchParams]
  );

  const handleChangePermissions = useCallback(
    (key: string) => (value: string) =>
      patchParams(key, {
        mode: 'role',
        permissions: value
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)
      } as unknown as Partial<ActionTriggerParams>),
    [patchParams]
  );

  const handleChangeCron = useCallback(
    (key: string) => (value: string) => patchParams(key, { cron: value }),
    [patchParams]
  );

  const handleChangeInput = useCallback(
    (key: string) => (fields: Record<string, ActionField>) => patchParams(key, { input: fields }),
    [patchParams]
  );

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">Ways in</span>
      <div className="flex flex-wrap gap-2">
        {KINDS.map(kind => (
          <Button
            key={kind}
            size="xs"
            intent={triggers.some(([, node]) => node.action === kind) ? 'primary' : 'secondary'}
            onClick={handleToggle(kind)}
          >
            {kind}
          </Button>
        ))}
      </div>

      {triggers.map(([key, node]) => {
        const params = node.params as ActionTriggerParams;
        const permissions = params.access?.mode === 'role' ? params.access.permissions.join(', ') : '';

        return (
          <div key={key} className="flex flex-col gap-2 rounded border border-gray-200 p-3">
            <span className="text-xs font-medium">{TITLES[node.action] ?? node.action}</span>

            {node.action === 'schedule' && (
              <Input
                value={params.cron ?? ''}
                label="Cron"
                size="xs"
                placeholder="0 * * * *"
                onChange={handleChangeCron(key)}
              />
            )}

            {node.action !== 'schedule' && (
              <Select value={params.access?.mode ?? 'session'} label="Who may" size="xs" onChange={handleChangeAccess(key)}>
                <option value="session">Signed-in visitors</option>
                <option value="role">Visitors with permissions</option>
                <option value="public">Anyone</option>
              </Select>
            )}

            {params.access?.mode === 'role' && (
              <Input
                value={permissions}
                label="Permissions"
                size="xs"
                placeholder="spaceManage, orders.write"
                onChange={handleChangePermissions(key)}
              />
            )}

            {node.action !== 'schedule' && (
              <ActionFields
                label="Input"
                hint="What a caller may send this way. Anything not declared is dropped before the flow runs."
                fields={params.input ?? {}}
                onChange={handleChangeInput(key)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ActionTriggers;
