import { createContext } from 'react';

import type { RefObject } from 'react';

/**
 * The page's own box, beside the panel — what the tools draw over, look in and measure, never the panel: the QA tools,
 * and the width a report from a run's preview says the page had.
 */
const PageContext = createContext<RefObject<HTMLElement | null>>({ current: null });
PageContext.displayName = 'PageContext';

export default PageContext;
