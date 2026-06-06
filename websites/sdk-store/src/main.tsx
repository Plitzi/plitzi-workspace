import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

// No StrictMode on purpose: it double-invokes render in dev, which would inflate the render-count read-outs in the
// useStoreGetter / useStoreSetter demos. The deployed build is production React anyway, so dev now matches it. The
// store itself is StrictMode-safe (covered by scopedStoreStrictMode.test.tsx in the package).
createRoot(rootElement).render(<App />);
