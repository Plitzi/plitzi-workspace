import { createContext } from 'react';

import type { SegmentsContextValue } from '@plitzi/sdk-shared';

const segmentsContextDefaultValue = {} as SegmentsContextValue;

const SegmentsContext = createContext<SegmentsContextValue>(segmentsContextDefaultValue);

export default SegmentsContext;
