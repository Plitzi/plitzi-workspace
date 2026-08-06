import { createRoot } from 'react-dom/client';

import App from './App';

import '@plitzi/plitzi-sdk/plitzi-sdk.css';

// Your app owns the root. Plitzi is mounted by App, as one component among yours.
createRoot(document.getElementById('root') as HTMLElement).render(<App />);
