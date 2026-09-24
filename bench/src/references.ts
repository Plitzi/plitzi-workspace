/**
 * What other Node frameworks typically cost, from public benchmarks and deployments — NOT measured by this bench.
 *
 * Node 22–24, production builds, `NODE_ENV=production`, a mid-sized page rendered on the server (300–800 nodes, no
 * database). They depend heavily on the page, so they place Plitzi's measured numbers among the field; they do not
 * rank it. Measuring each framework here instead was ruled out: a bench that builds and keeps other frameworks
 * running is one nobody can maintain.
 */
export type Reference = {
  name: string;
  /** Resident memory at rest, MB. */
  idleMb: [number, number];
  /** Resident memory under load, MB. */
  loadedMb: [number, number];
  /** Pages rendered for their request, per vCPU. Undefined where the figure is not a page render. */
  rpsPerVcpu?: [number, number];
};

export const REFERENCES: Reference[] = [
  { name: 'Node `http`, bare (floor)', idleMb: [40, 50], loadedMb: [60, 80] },
  { name: 'Express 5 + React', idleMb: [70, 120], loadedMb: [150, 300], rpsPerVcpu: [300, 1000] },
  { name: 'Fastify + React', idleMb: [60, 100], loadedMb: [130, 250], rpsPerVcpu: [400, 1200] },
  { name: 'Next.js 15/16, App Router (RSC)', idleMb: [150, 300], loadedMb: [350, 800], rpsPerVcpu: [100, 500] },
  { name: 'Next.js, Pages Router', idleMb: [120, 220], loadedMb: [250, 500], rpsPerVcpu: [200, 700] },
  { name: 'Remix / React Router 7', idleMb: [80, 150], loadedMb: [180, 350], rpsPerVcpu: [400, 1200] },
  { name: 'Nuxt 3/4', idleMb: [80, 150], loadedMb: [180, 350], rpsPerVcpu: [400, 1500] },
  { name: 'Angular SSR', idleMb: [150, 250], loadedMb: [300, 600], rpsPerVcpu: [150, 500] },
  { name: 'SvelteKit', idleMb: [50, 90], loadedMb: [100, 200], rpsPerVcpu: [1000, 3000] },
  { name: 'Astro SSR', idleMb: [60, 100], loadedMb: [120, 220], rpsPerVcpu: [1000, 3000] },
  { name: 'SolidStart', idleMb: [60, 100], loadedMb: [120, 220], rpsPerVcpu: [1500, 4000] },
  { name: 'Qwik City', idleMb: [60, 110], loadedMb: [120, 250], rpsPerVcpu: [1000, 2500] }
];
