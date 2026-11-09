declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: Record<string, unknown>;
  }
}

export const disableReactDevTools = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const noop = () => undefined;
  const DEV_TOOLS = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (typeof DEV_TOOLS !== 'object') {
    return;
  }

  Object.keys(DEV_TOOLS).forEach(toolKey => {
    const tool = DEV_TOOLS[toolKey];
    DEV_TOOLS[toolKey] = typeof tool === 'function' ? noop : null;
  });
};

/**
 * The Trusted Types policies the SDK makes, by name: what a page's policy lets write markup into it
 * (`trusted-types …`, the server's header), and what the SDK creates them as (`security`) — one list, so the two cannot
 * come apart.
 *
 * - `plitzi-html`: markup the page itself made — the server's own HTML kept through hydration, the dev tools'.
 * - `plitzi-author-html`: markup an author or the data wrote — a raw HTML block, rich text, an SVG — cleaned when the
 *   page's script policy is enforced (sdk-elements, beside the cleaner).
 * - `default`: what a library writes without asking for a policy, and only what cannot run: text (the head's JSON-LD,
 *   which Helmet writes as `innerHTML`), the empty script React makes one from, JSON as a script, and a worker from the
 *   page's own origin (a map's, from a `blob:` it made; the builder's, from its assets).
 * - `dompurify`: the cleaner's own, which it makes to read the markup it is handed before it cleans it.
 */
export const TRUSTED_TYPES_POLICIES = ['plitzi-html', 'plitzi-author-html', 'default', 'dompurify'] as const;

export type TrustedTypesPolicyName = (typeof TRUSTED_TYPES_POLICIES)[number];
