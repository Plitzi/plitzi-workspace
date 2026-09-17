import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';

import type { SourceField } from '@plitzi/sdk-shared';

/**
 * Every path of a source's data, named by its last two segments — what the binding picker lists for a provider, a
 * modal or a dialog. Only ever run when the picker asks: see `useRegisterSource`.
 */
const pathFields = (data: Record<string, unknown>): SourceField[] =>
  getPathsFromObeject(data).map(path => ({ path, name: path.split('.').slice(-2).join(' ') }));

export default pathFields;
