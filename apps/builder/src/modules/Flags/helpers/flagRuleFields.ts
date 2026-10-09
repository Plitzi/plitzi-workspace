import { getPathsFromObject } from '@plitzi/sdk-shared/helpers/utils';

import type { Field } from '@plitzi/plitzi-ui/QueryBuilder';
import type { QueryParams, RouteParams } from '@plitzi/sdk-shared';

const ENVIRONMENTS = ['main', 'development', 'staging', 'production'];

/**
 * What a flag's rule may be written over: everything a variable's `when` sees — the environment, the host, the URL the
 * builder is previewing — and the visitor, whose roles are offered from the ones this space declares.
 */
export const flagRuleFields = ({
  routeParams,
  queryParams,
  visitorRoles
}: {
  routeParams: RouteParams;
  queryParams: QueryParams;
  visitorRoles: string[];
}): Record<string, Field> => {
  const urlFields = getPathsFromObject({ routeParams, queryParams }).map((path): Field => ({
    name: path,
    label: path,
    placeholder: `Enter ${path}`
  }));
  const fields: Field[] = [
    {
      name: 'environment',
      label: 'Environment',
      inputType: 'select',
      options: ENVIRONMENTS.map(environment => ({ value: environment, label: environment }))
    },
    { name: 'hostname', label: 'Host', placeholder: 'app.example.com' },
    ...urlFields,
    { name: 'user.authenticated', label: 'Visitor is signed in', inputType: 'checkbox' },
    { name: 'user.email', label: 'Visitor email', placeholder: 'someone@example.com' },
    { name: 'user.username', label: 'Visitor username' },
    {
      name: 'user.roles',
      label: 'Visitor roles',
      defaultOperator: 'contains',
      ...(visitorRoles.length > 0
        ? { inputType: 'select', options: visitorRoles.map(role => ({ value: role, label: role })) }
        : { placeholder: 'A role this space declares' })
    }
  ];

  return Object.fromEntries(fields.map(field => [field.name, field]));
};
