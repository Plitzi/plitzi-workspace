import { createRoot } from 'react-dom/client';

import App from './App';

import '@fortawesome/fontawesome-free/css/all.min.css';
import '@plitzi/plitzi-sdk/plitzi-sdk.css';
import './assets/index.css';

const container = document.getElementById('plitzi-desktop');
if (container) {
  createRoot(container).render(<App />);
}
