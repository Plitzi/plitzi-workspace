import { isTrue } from './truthiness';

import type { DataSourceUtility } from '../../types';

/**
 * The inverse of the value, as a boolean.
 *
 * A binding shows an element when its field is true and there is no "unless", so without this every condition a
 * page reads has to arrive from the server in both polarities — `found` AND `missing`, `signedIn` AND `signedOut`.
 * That is a field per question that exists only because the client could not say "not", and it puts the answer to
 * "when is this hidden?" in a different repository from the page that hides it.
 */
const not: DataSourceUtility<unknown, boolean> = {
  action: 'not',
  title: 'Not',
  type: 'utility',
  params: {},
  preview: { content: '' },
  callback: (source: unknown) => !isTrue(source)
};

export default not;
