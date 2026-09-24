/**
 * What other Node frameworks typically cost, from public benchmarks and deployments — NOT measured by this bench.
 *
 * Node 22–24, production builds, `NODE_ENV=production`, a mid-sized page rendered on the server (300–800 nodes, no
 * database). They depend heavily on the page, so they place Plitzi's measured numbers among the field; they do not
 * rank it. Measuring each framework here was ruled out: a bench that builds and keeps other frameworks running is one
 * nobody can maintain. Kept as the text the report shows, since that is all they are.
 */
export type Reference = {
  name: string;
  idle: string;
  loaded: string;
  /** Pages rendered for their request, a second per vCPU. */
  ssrPerVcpu: string;
  /** A published page served from a cache — where any framework stops mattering. */
  cached: string;
  /** What a pod of it is usually given, request → limit. */
  pod: string;
};

const CACHED = '10,000–50,000';

export const REFERENCES: Reference[] = [
  {
    name: 'Node `http`, bare (floor)',
    idle: '40–50 MB',
    loaded: '60–80 MB',
    ssrPerVcpu: '— (hello world 25–40k)',
    cached: CACHED,
    pod: '0.1 vCPU / 64–128 Mi'
  },
  {
    name: 'Express 5 + React (`renderToPipeableStream`)',
    idle: '70–120 MB',
    loaded: '150–300 MB',
    ssrPerVcpu: '300–1,000',
    cached: CACHED,
    pod: '0.25–0.5 vCPU / 256–512 Mi'
  },
  {
    name: 'Fastify + React',
    idle: '60–100 MB',
    loaded: '130–250 MB',
    ssrPerVcpu: '400–1,200',
    cached: CACHED,
    pod: '0.25–0.5 vCPU / 256–512 Mi'
  },
  {
    name: 'Next.js 15/16 (App Router, RSC, standalone)',
    idle: '150–300 MB',
    loaded: '350–800 MB (sometimes more)',
    ssrPerVcpu: '100–500',
    cached: CACHED,
    pod: '0.5–1 vCPU / 512 Mi–1 Gi'
  },
  {
    name: 'Next.js (Pages Router, SSR only)',
    idle: '120–220 MB',
    loaded: '250–500 MB',
    ssrPerVcpu: '200–700',
    cached: CACHED,
    pod: '0.5 vCPU / 512 Mi'
  },
  {
    name: 'Remix / React Router 7',
    idle: '80–150 MB',
    loaded: '180–350 MB',
    ssrPerVcpu: '400–1,200',
    cached: CACHED,
    pod: '0.25–0.5 vCPU / 256–512 Mi'
  },
  {
    name: 'Nuxt 3/4 (Nitro, node-server)',
    idle: '80–150 MB',
    loaded: '180–350 MB',
    ssrPerVcpu: '400–1,500',
    cached: CACHED,
    pod: '0.25–0.5 vCPU / 256–512 Mi'
  },
  {
    name: 'Angular SSR',
    idle: '150–250 MB',
    loaded: '300–600 MB',
    ssrPerVcpu: '150–500',
    cached: CACHED,
    pod: '0.5–1 vCPU / 512 Mi–1 Gi'
  },
  {
    name: 'SvelteKit (Svelte 5, adapter-node)',
    idle: '50–90 MB',
    loaded: '100–200 MB',
    ssrPerVcpu: '1,000–3,000',
    cached: CACHED,
    pod: '0.1–0.25 vCPU / 128–256 Mi'
  },
  {
    name: 'Astro SSR (adapter node, islands)',
    idle: '60–100 MB',
    loaded: '120–220 MB',
    ssrPerVcpu: '1,000–3,000',
    cached: CACHED,
    pod: '0.1–0.25 vCPU / 128–256 Mi'
  },
  {
    name: 'SolidStart',
    idle: '60–100 MB',
    loaded: '120–220 MB',
    ssrPerVcpu: '1,500–4,000',
    cached: CACHED,
    pod: '0.1–0.25 vCPU / 128–256 Mi'
  },
  {
    name: 'Qwik City',
    idle: '60–110 MB',
    loaded: '120–250 MB',
    ssrPerVcpu: '1,000–2,500',
    cached: CACHED,
    pod: '0.1–0.25 vCPU / 128–256 Mi'
  },
  {
    name: '_Bun or Deno instead of Node_',
    idle: '−20–40 %',
    loaded: '−20–30 %',
    ssrPerVcpu: '+30–100 %',
    cached: '—',
    pod: '—'
  }
];
