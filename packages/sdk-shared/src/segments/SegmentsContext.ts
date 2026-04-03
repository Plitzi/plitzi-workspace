import { createContext } from 'react';

import type { SegmentsContextValue } from '../types';

const SegmentsContext = createContext({ segments: {} } as SegmentsContextValue);

export default SegmentsContext;
