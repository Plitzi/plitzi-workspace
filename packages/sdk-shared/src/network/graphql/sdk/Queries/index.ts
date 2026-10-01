import InitQuery from './InitQuery';

import type { TInitQuery } from './InitQuery';

export type SdkQueriesMap = {
  Init: TInitQuery;
};

const SdkQueries: Record<keyof SdkQueriesMap, string> = {
  Init: InitQuery
};

export default SdkQueries;
