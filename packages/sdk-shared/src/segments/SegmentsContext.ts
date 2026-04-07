import { createContext } from 'react';

import type { SegmentsContextValue } from '../types';

const SegmentsContext = createContext({} as SegmentsContextValue);

export default SegmentsContext;
