import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import { use, useCallback, useState } from 'react';

import { EventBridgeContext } from '@plitzi/sdk-event-bridge';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import Notice from '@pmodules/App/components/Notice';
import ViewPage from '@pmodules/App/components/ViewPage';
import ViewSection from '@pmodules/App/components/ViewSection';
import PlanNotice from '@pmodules/Space/components/PlanNotice';

import ChannelCard from './components/ChannelCard';
import { checkChannels, draftOf, NEW_CHANNEL } from './helpers';

import type { ChannelDraft } from './helpers';
import type { ChannelDeclarations } from '@plitzi/sdk-shared';

const draftsOf = (channels: ChannelDeclarations): Record<string, ChannelDraft> =>
  Object.fromEntries(Object.entries(channels).map(([pattern, declaration]) => [pattern, draftOf(declaration)]));

/**
 * The space's realtime channels (`settings.channels`): the patterns its pages may open a channel on, who may join and
 * speak on each, and what the server keeps of it.
 *
 * Saved as they are edited, and only when every channel is one the server accepts — `channelProblems`, the check
 * authoring and the server make — so the document never holds a channel that would be refused: what is wrong is said
 * under the channel until it is fixed.
 */
const Channels = () => {
  const { eventBridge } = use(EventBridgeContext);
  const [[channels = {}]] = useBuilderStore(['schema.settings.channels']);
  const [drafts, setDrafts] = useState<Record<string, ChannelDraft>>(() => draftsOf(channels));
  const [problems, setProblems] = useState<Record<string, string[]>>({});
  const [newPattern, setNewPattern] = useState('');
  const [addProblem, setAddProblem] = useState('');

  const save = useCallback(
    (next: Record<string, ChannelDraft>) => {
      setDrafts(next);
      const checked = checkChannels(next);
      if (!checked.ok) {
        setProblems(checked.problems);

        return;
      }

      setProblems({});
      void eventBridge.emit('main', 'schemaUpdateSettings', checked.channels, 'channels');
    },
    [eventBridge]
  );

  const handleChange = useCallback(
    (pattern: string, draft: ChannelDraft) => save({ ...drafts, [pattern]: draft }),
    [drafts, save]
  );

  const handleRemove = useCallback(
    (pattern: string) => {
      const { [pattern]: _removed, ...rest } = drafts;
      save(rest);
    },
    [drafts, save]
  );

  const handleAdd = useCallback(() => {
    const pattern = newPattern.trim();
    if (!pattern) {
      setAddProblem('Name the channel first, like "board:{id}" — {id} is the part a page fills in.');

      return;
    }

    if (pattern in drafts) {
      setAddProblem(`The space already has the channel "${pattern}".`);

      return;
    }

    setAddProblem('');
    setNewPattern('');
    save({ ...drafts, [pattern]: NEW_CHANNEL });
  }, [drafts, newPattern, save]);

  return (
    <ViewPage
      className="gap-8"
      description="Channels carry what happens to every page listening, as it happens: a page opens one with a Channel element, and a server action speaks on it with its Publish On Channel step. A page may open only a channel the space declares here."
    >
      <PlanNotice capability="realtime" meanwhile="Channels can be declared; pages are refused them until then." />
      <ViewSection title="Channels">
        {Object.entries(drafts).map(([pattern, draft]) => (
          <ChannelCard
            key={pattern}
            pattern={pattern}
            draft={draft}
            problems={problems[pattern]}
            onChange={handleChange}
            onRemove={handleRemove}
          />
        ))}
        {Object.keys(drafts).length === 0 && (
          <span className="text-xs text-gray-500 dark:text-zinc-400">No channels yet: add one below.</span>
        )}
        <div className="flex items-end gap-2">
          <Input
            size="sm"
            className="grow"
            name="newChannel"
            value={newPattern}
            onChange={setNewPattern}
            label="New channel"
            placeholder="tables, or board:{id}"
          />
          <Button size="sm" onClick={handleAdd}>
            Add channel
          </Button>
        </div>
        {addProblem && <Notice tone="danger">{addProblem}</Notice>}
      </ViewSection>
    </ViewPage>
  );
};

export default Channels;
