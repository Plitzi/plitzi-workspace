import Button from '@plitzi/plitzi-ui/Button';
import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import type { ChannelAccessMode, ChannelDraft } from '../../helpers';
import type { ChangeEvent } from 'react';

export type ChannelCardProps = {
  pattern: string;
  draft: ChannelDraft;
  problems?: string[];
  onChange: (pattern: string, draft: ChannelDraft) => void;
  onRemove: (pattern: string) => void;
};

const isAccessMode = (value: string): value is ChannelAccessMode =>
  value === 'public' || value === 'session' || value === 'role';

/** One channel of the space: who may join it, who may speak on it, and what the server keeps of it. */
const ChannelCard = ({ pattern, draft, problems = [], onChange, onRemove }: ChannelCardProps) => {
  const change = useCallback(
    (patch: Partial<ChannelDraft>) => onChange(pattern, { ...draft, ...patch }),
    [draft, onChange, pattern]
  );

  const handleMode = useCallback(
    (value: string) => {
      if (isAccessMode(value)) {
        change({ mode: value });
      }
    },
    [change]
  );
  const handlePermissions = useCallback((value: string) => change({ permissions: value }), [change]);
  const handlePublish = useCallback(
    (value: string) => change({ publish: value === 'server' ? 'server' : 'clients' }),
    [change]
  );
  const handlePresence = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => change({ presence: event.target.checked }),
    [change]
  );
  const handleGrant = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => change({ grant: event.target.checked }),
    [change]
  );
  const handleRetain = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => change({ retain: event.target.checked }),
    [change]
  );
  const handleMaxBytes = useCallback((value: string) => change({ maxMessageBytes: value }), [change]);
  const handleRate = useCallback((value: string) => change({ messagesPerSecond: value }), [change]);
  const handleRemove = useCallback(() => onRemove(pattern), [onRemove, pattern]);

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 dark:border-zinc-700"
      data-channel={pattern}
    >
      <div className="flex items-center justify-between gap-2">
        <code className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-50">{pattern}</code>
        <Button size="xs" intent="danger" onClick={handleRemove}>
          Remove
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select size="sm" name={`${pattern}-access`} label="Who may join" value={draft.mode} onChange={handleMode}>
          <option value="public">Anyone, signed out included</option>
          <option value="session">Signed-in visitors</option>
          <option value="role">Visitors with permissions</option>
        </Select>
        <Select
          size="sm"
          name={`${pattern}-publish`}
          label="Who may speak"
          value={draft.publish}
          onChange={handlePublish}
        >
          <option value="clients">Pages, directly</option>
          <option value="server">Only the server — an action's Publish On Channel</option>
        </Select>
      </div>
      {draft.mode === 'role' && (
        <Input
          size="sm"
          name={`${pattern}-permissions`}
          label="Permissions (comma separated)"
          placeholder="boardEdit"
          value={draft.permissions}
          onChange={handlePermissions}
        />
      )}
      <div className="flex flex-col gap-1">
        <Checkbox
          size="xs"
          name={`${pattern}-presence`}
          label=" Who is here — pages announce themselves"
          checked={draft.presence}
          onChange={handlePresence}
        />
        <Checkbox
          size="xs"
          name={`${pattern}-grant`}
          label=" Private — a page needs a grant from an action to open a topic"
          checked={draft.grant}
          onChange={handleGrant}
        />
        <Checkbox
          size="xs"
          name={`${pattern}-retain`}
          label=" Keep the last message of each type, for pages that open later"
          checked={draft.retain}
          onChange={handleRetain}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          size="sm"
          type="number"
          name={`${pattern}-max-bytes`}
          label="Largest message a page sends (bytes)"
          placeholder="4096"
          value={draft.maxMessageBytes}
          onChange={handleMaxBytes}
        />
        <Input
          size="sm"
          type="number"
          name={`${pattern}-rate`}
          label="Messages a page sends a second"
          placeholder="30"
          value={draft.messagesPerSecond}
          onChange={handleRate}
        />
      </div>
      {problems.length > 0 && (
        <ul className="list-inside list-disc text-xs text-red-600 dark:text-red-400" role="alert">
          {problems.map(problem => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ChannelCard;
