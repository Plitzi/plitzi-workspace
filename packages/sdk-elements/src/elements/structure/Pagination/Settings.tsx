import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

type SettingsProps = {
  mode?: 'pages' | 'loadMore';
  target?: 'url' | 'interaction';
  pageParam?: string;
  windowSize?: string;
  previousLabel?: string;
  nextLabel?: string;
  loadMoreLabel?: string;
  onUpdate?: (key: string, value: string | boolean | number | object) => void;
};

const Settings = ({
  mode = 'pages',
  target = 'url',
  pageParam = 'page',
  windowSize = '5',
  previousLabel = 'Previous',
  nextLabel = 'Next',
  loadMoreLabel = 'Load more',
  onUpdate
}: SettingsProps) => {
  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  return (
    <div className="flex grow flex-col gap-4 py-2">
      <Select value={mode} label="Mode" onChange={handleChange('mode')} size="xs">
        <option value="pages">Numbered pages</option>
        <option value="loadMore">Load more</option>
      </Select>
      <Select value={target} label="On Page Change" onChange={handleChange('target')} size="xs">
        <option value="url">Update the URL</option>
        <option value="interaction">Only fire the trigger</option>
      </Select>
      {target === 'url' && (
        <Input
          value={pageParam}
          label="Page parameter"
          title="Must match the page parameter of the provider this pager belongs to."
          onChange={handleChange('pageParam')}
          size="xs"
        />
      )}
      {mode === 'pages' && (
        <>
          <Input value={windowSize} label="Pages shown" onChange={handleChange('windowSize')} size="xs" />
          <Input value={previousLabel} label="Previous label" onChange={handleChange('previousLabel')} size="xs" />
          <Input value={nextLabel} label="Next label" onChange={handleChange('nextLabel')} size="xs" />
        </>
      )}
      {mode === 'loadMore' && (
        <Input value={loadMoreLabel} label="Button label" onChange={handleChange('loadMoreLabel')} size="xs" />
      )}
      <span className="text-xs text-gray-500">
        Bind <strong>pageInfo</strong> to your provider&apos;s page info, for example{' '}
        <code>apiContainer_posts.pageInfo</code>.
      </span>
    </div>
  );
};

export default Settings;
