import { sharedContext } from '../helpers/sharedContext';

import type { SegmentsContextValue } from '../types';

const SegmentsContext = sharedContext('SegmentsContext', {} as SegmentsContextValue);

export default SegmentsContext;
