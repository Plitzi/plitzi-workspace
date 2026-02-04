import { QueryBuilderFormatter } from '@plitzi/plitzi-ui/QueryBuilder';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';

const whenString = (when?: RuleGroup) => {
  if (!when) {
    return 'None';
  }

  const str = QueryBuilderFormatter(when);
  if (str) {
    return str;
  }

  return 'None';
};

export default whenString;
