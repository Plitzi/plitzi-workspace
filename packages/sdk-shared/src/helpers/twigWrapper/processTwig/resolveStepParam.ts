import { processTwigParam } from './processTwig';
import { hasTemplateSyntax } from '../tokens/hasTemplateSyntax';
import { hasValidToken } from '../tokens/hasValidToken';

/** How many times a value may resolve to another template before the resolver stops and says so. */
export const MAX_PARAM_PASSES = 5;

/**
 * One step param, resolved against the flow's scope — the ONE resolver for the browser's flows and a server action's
 * steps, so a param means the same on both sides.
 *
 * The param as written is a template whatever it holds: a condition, a loop or an object literal as much as a name —
 * which is why the first pass runs on any template syntax, not only on what `hasValidToken` recognises (it answers a
 * narrower question, for attributes, where the text around a token is prose). The server used to skip that first pass,
 * so `{{ { "id": run.id } }}` reached its task as the template text. What a pass RETURNS is data, and is read again only
 * when it carries a well-formed token — so text a visitor typed that happens to contain braces is not evaluated — up to
 * {@link MAX_PARAM_PASSES}. `unresolved` says the ceiling was hit with tokens left, for the caller to report.
 */
export const resolveStepParam = (
  template: string,
  scope: Record<string, unknown>
): { value: unknown; unresolved: boolean } => {
  let value: unknown = template;
  let passes = MAX_PARAM_PASSES;
  if (hasTemplateSyntax(value) && !hasValidToken(template)) {
    value = processTwigParam(template, scope);
    passes--;
  }

  while (typeof value === 'string' && hasValidToken(value) && passes > 0) {
    value = processTwigParam(value, scope);
    passes--;
  }

  return { value, unresolved: typeof value === 'string' && hasValidToken(value) };
};
