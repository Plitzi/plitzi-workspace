import { Probe } from './probe';

/** `runtime: 'client'` — skipped during SSR, so seeing it at all means the browser rendered it. */
const ClientProbe = () => <Probe runtime="client" data={{ inBrowser: typeof window !== 'undefined' }} />;

export default ClientProbe;
