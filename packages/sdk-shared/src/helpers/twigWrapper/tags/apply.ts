import { applyFilters } from '../filters/filters';
import { APPLY_TAG } from '../patterns/patterns';

// Processes `{% apply %}` tags: applies filters to a block of content.
// Syntax: `{% apply filter1|filter2|... %}content{% endapply %}`
// The content inside is rendered first, then the specified filters are applied to the result.
// This is processed AFTER token rendering so the content is already resolved.
export const applyApplyTag = (template: string, context: Record<string, unknown>): string => {
  APPLY_TAG.lastIndex = 0;
  return template.replace(APPLY_TAG, (_full, filtersStr: string, content: string) => {
    // Prepend `|` so the standard filter pipeline picks up every filter name.
    const filtersPipe = filtersStr
      .split('|')
      .map(f => f.trim())
      .filter(Boolean)
      .map(f => `| ${f}`)
      .join(' ');
    return applyFilters(content, filtersPipe, context) as string;
  });
};
