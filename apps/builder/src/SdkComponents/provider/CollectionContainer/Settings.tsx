import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import QueryBuilder from '@plitzi/plitzi-ui/QueryBuilder';
import Select from '@plitzi/plitzi-ui/Select';
import get from 'lodash/get';
import { use, useCallback, useMemo } from 'react';

import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { Collection, CollectionRecord } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

type SettingsProps = {
  source?: string;
  query?: RuleGroup;
  limit?: string;
  singleRecord?: boolean;
  onUpdate?: (key: string, value: string | boolean | number | RuleGroup) => void;
};

const Settings = ({ source = '', query, limit = '10', singleRecord = false, onUpdate }: SettingsProps) => {
  const {
    contexts: { CollectionContext, NavigationContext }
  } = usePlitziServiceContext();
  const { collections } = use(CollectionContext);
  const { routeParams, queryParams } = use(NavigationContext);

  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  const handleChangeIsPlugin = useCallback(
    (key: string) => (e: ChangeEvent) => onUpdate?.(key, (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  const handleChangeQuery = useCallback((whenQuery: RuleGroup) => onUpdate?.('when', whenQuery), [onUpdate]);

  const fieldsDataSource = useMemo(() => {
    if (!source || !(collections[source] as Collection | undefined)) {
      return {};
    }

    const record = get(collections, `${source}.records.0`, undefined) as CollectionRecord | undefined;
    if (!record) {
      return {};
    }

    return getPathsFromObeject({ values: record.values, routeParams, queryParams, _id: record.id }).reduce(
      (acum, path) => ({ ...acum, [path]: { name: path, label: path, placeholder: `Enter ${path}` } }),
      {}
    );
  }, [collections, source, routeParams, queryParams]);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Select label="Source" value={source} onChange={handleChange('source')}>
        <option value="">Select a Source</option>
        {Object.values(collections).map((collection, i) => (
          <option key={i} value={collection.id}>
            {collection.name}
          </option>
        ))}
      </Select>
      {source && (
        <>
          <div className="flex flex-col">
            <label>Query</label>
            <QueryBuilder
              direction="vertical"
              className="w-full"
              query={query}
              fields={fieldsDataSource}
              onChange={handleChangeQuery}
              showBranches
              allowSubGroups={false}
            />
          </div>
          <Checkbox label="Single Record" checked={singleRecord} onChange={handleChangeIsPlugin('singleRecord')} />
        </>
      )}

      {!singleRecord && <Input value={limit} label="Limit" onChange={handleChange('limit')} />}
    </div>
  );
};

export default Settings;
