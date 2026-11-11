/**
 * A page's HTML as an agent reads it: the markup, without what it cannot use — the hydration payload (the space's whole
 * document as JSON, megabytes on a large space), scripts and stylesheets — and cut at a size an answer may hold, said
 * where it is cut. Whole, a look at Plitzi's own pricing page answered 3 MB: 923,000 tokens, more than any context.
 */

/** What an answer's HTML may hold, in characters: ~25,000 tokens. */
export const AGENT_HTML_CHARS = 100_000;

const kilobytes = (chars: number): string => `${String(Math.round(chars / 1000))} KB`;

export const agentHtml = (html: string, limit = AGENT_HTML_CHARS): string => {
  const markup = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, script => {
      const open = /^<script\b[^>]*>/i.exec(script)?.[0] ?? '<script>';

      return script.length > open.length + '</script>'.length
        ? `${open}<!-- ${kilobytes(script.length)} left out --></script>`
        : script;
    })
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, style =>
      style.length > 200 ? `<style><!-- ${kilobytes(style.length)} of CSS left out --></style>` : style
    );
  if (markup.length <= limit) {
    return markup;
  }

  return `${markup.slice(0, limit)}\n<!-- cut at ${kilobytes(limit)} of ${kilobytes(markup.length)}: view "accessibility" reads the whole page as an outline, and plitzi_read a page's elements by ref -->`;
};
