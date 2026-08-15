import { createRoot } from 'react-dom/client';

import Harness from './Harness';

import './preflight.css';
import '@plitzi/plitzi-sdk/plitzi-sdk.css';

const container = document.getElementById('harness-root');

if (!container) {
  throw new Error('harness-root is missing from index.html');
}

createRoot(container).render(<Harness />);
