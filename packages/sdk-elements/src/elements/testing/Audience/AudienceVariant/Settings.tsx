import QueryBuilder from '@plitzi/plitzi-ui/QueryBuilder';
import { useCallback, useMemo } from 'react';

import { useCommonStore } from '@plitzi/sdk-shared/store';

import { audienceRuleFields } from '../../../../builder/ruleFields';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';

const NO_RULES: RuleGroup = { combinator: 'and', rules: [] };

type SettingsProps = {
  when?: RuleGroup;
  onUpdate?: (key: string, value: RuleGroup) => void;
};

/** An audience variant's settings: the visitors it is for. */
const Settings = ({ when = NO_RULES, onUpdate }: SettingsProps) => {
  const [[routeParams = {}, queryParams = {}, visitorRoles]] = useCommonStore([
    'navigation.routeParams',
    'navigation.queryParams',
    'schema.settings.visitorRoles'
  ]);
  const fields = useMemo(
    () => audienceRuleFields({ routeParams, queryParams, visitorRoles: Object.keys(visitorRoles ?? {}) }),
    [routeParams, queryParams, visitorRoles]
  );

  const handleChange = useCallback((query: RuleGroup) => onUpdate?.('when', query), [onUpdate]);

  return (
    <div className="flex flex-col gap-4 py-2">
      <QueryBuilder
        direction="vertical"
        intent="gray"
        className="w-full"
        query={when}
        fields={fields}
        onChange={handleChange}
        showBranches
      />
      <span className="text-ui-fg-subtle text-xs">
        The audience shows the first variant whose rule the visitor matches. With no conditions, this one is for
        everybody the variants before it did not take — put it last.
      </span>
    </div>
  );
};

export default Settings;
