import InitQuery from './InitQuery';
import SegmentQuery from './Segment/SegmentQuery';
import SegmentsQuery from './Segment/SegmentsQuery';

import type { TInitQuery } from './InitQuery';
import type { TSegmentQuery } from './Segment/SegmentQuery';
import type { TSegmentsQuery } from './Segment/SegmentsQuery';

export type SdkQueriesMap = {
  Init: TInitQuery;
  Segment: TSegmentQuery;
  Segments: TSegmentsQuery;
};

const SdkQueries: Record<keyof SdkQueriesMap, string> = {
  Init: InitQuery,
  Segment: SegmentQuery,
  Segments: SegmentsQuery
};

export default SdkQueries;
