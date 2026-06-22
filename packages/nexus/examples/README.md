# Nexus examples

Real, copy-pasteable examples proving `@plitzi/nexus` is framework-agnostic. The agnostic core lives in
`@plitzi/nexus`; each framework binds to it through its own integration (or, where there is no dedicated
integration yet, directly via `store.subscribe` / `store.getState`).

| Example | Entry used | Shows |
|---|---|---|
| [react](./react) | `@plitzi/nexus/react` | Provider + hooks, persist + history |
| [next](./next) | `@plitzi/nexus/react` + `@plitzi/nexus/next` | RSC server snapshot + server action |
| [astro-6](./astro-6) | `@plitzi/nexus/react` + `@plitzi/nexus` | Astro **6 LTS** islands: Provider-in-island + cross-island singleton |
| [astro-7](./astro-7) | `@plitzi/nexus/react` + `@plitzi/nexus` | Astro **7** (Vite 8 / Rust compiler): same two patterns |
| [vue](./vue) | `@plitzi/nexus` | Core consumed directly from a Vue composable (no React) |
| [svelte](./svelte) | `@plitzi/nexus` | Core consumed directly via the Svelte store contract (no React) |

The **vue** and **svelte** examples deliberately import only `@plitzi/nexus` — they are the proof that the core
carries no React dependency.
