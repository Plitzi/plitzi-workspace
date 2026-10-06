import useStorage from '@plitzi/plitzi-ui/hooks/useStorage';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import UsageList from './components/UsageList';
import { CATEGORY_COPY, isUsageCategory, USAGE_CATEGORIES } from './helpers/copy';
import { isUnused } from './helpers/usageIndex';
import useUsageIndex from './hooks/useUsageIndex';

/**
 * Where the space uses what it declares — components, classes, style tokens and space variables, data sources — and
 * what nothing uses. Every use is a link to the element, on whichever page, layout or component it is.
 *
 * A panel beside the canvas rather than a dialog over it: following uses one after another is the job, and the list
 * has to stay where it is while each one is looked at. The kinds are picked from a list rather than tabs, so each can
 * say how many there are, and how many nobody uses, at the panel's narrowest.
 */
const Usages = () => {
  const index = useUsageIndex();
  const [stored, setStored] = useStorage<string>('builder-state.usages.category', 'components');
  const category = isUsageCategory(stored) ? stored : 'components';

  const handleCategory = useCallback((value: string) => setStored(value), [setStored]);

  return (
    <div className="flex h-full min-h-0 w-full grow basis-0 flex-col">
      <div className="px-2 pt-2">
        <Select size="xs" value={category} title="What to find the uses of" onChange={handleCategory}>
          {USAGE_CATEGORIES.map(option => (
            <option key={option} value={option}>
              {CATEGORY_COPY[option].label} · {index[option].length} ({index[option].filter(isUnused).length} unused)
            </option>
          ))}
        </Select>
      </div>
      <UsageList key={category} category={category} items={index[category]} />
    </div>
  );
};

export default Usages;
