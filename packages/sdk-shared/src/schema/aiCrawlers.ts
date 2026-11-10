/**
 * The AI crawlers a space's `/robots.txt` may keep out, by what they do — so whoever owns the space decides each on its
 * own (`settings.blockAiCrawlers`). One switch for all of them kept assistants out of a product whose way in is an
 * agent; now a site may refuse to train a model and still be read for a person who asked.
 *
 * - `training` — gathering pages to train models.
 * - `assistants` — an assistant fetching a page because a person asked it to, now.
 * - `search` — building the index an AI search answers from.
 *
 * Each by the user agent it reads `/robots.txt` as. A search engine's own crawler is none of them: Googlebot reads on,
 * Google-Extended (the one that trains) does not.
 */
export const AI_CRAWLERS = {
  training: [
    'GPTBot',
    'ClaudeBot',
    'anthropic-ai',
    'Google-Extended',
    'Applebot-Extended',
    'CCBot',
    'Bytespider',
    'Amazonbot',
    'meta-externalagent'
  ],
  assistants: ['ChatGPT-User', 'Claude-User', 'Perplexity-User', 'MistralAI-User'],
  search: ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot']
} as const satisfies Record<string, readonly string[]>;

/** The kinds, in the order a setting lists them: a tuple, so a schema validator can take it as its values. */
export const AI_CRAWLER_KINDS = [
  'training',
  'assistants',
  'search'
] as const satisfies readonly (keyof typeof AI_CRAWLERS)[];

export type AiCrawlerKind = (typeof AI_CRAWLER_KINDS)[number];

/** What each kind is, in the words a setting shows its owner. */
export const AI_CRAWLER_KIND_LABEL: Record<AiCrawlerKind, string> = {
  training: 'Crawlers that train AI models',
  assistants: 'Assistants fetching a page for a person',
  search: 'AI search indexes'
};

export const isAiCrawlerKind = (value: unknown): value is AiCrawlerKind =>
  typeof value === 'string' && value in AI_CRAWLERS;

/** The user agents a space keeps out, for the kinds it names — none when it names none, or names them wrong. */
export const blockedAiCrawlers = (kinds: unknown): string[] =>
  Array.isArray(kinds) ? kinds.filter(isAiCrawlerKind).flatMap(kind => [...AI_CRAWLERS[kind]]) : [];
