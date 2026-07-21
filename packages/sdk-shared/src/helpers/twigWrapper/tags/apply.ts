import { applyFilters } from '../filters/filters';
import { APPLY_TAG } from '../patterns/patterns';

// Matches the opening `{% apply ... %}` and closing `{% endapply %}` tags for scanning nesting depth.
const APPLY_OPEN = /\{%\s*apply\s+((?:(?!%\})[\s\S])+?)\s*%\}/g;
const APPLY_CLOSE = /\{%\s*endapply\s*%\}/g;

// Processes `{% apply %}` tags: applies filters to a block of content.
// Syntax: `{% apply filter1|filter2|... %}content{% endapply %}`
// Handles nested apply tags correctly by counting depth — the innermost pair is processed first,
// then the result is used by the outer pair. This prevents the outer filter from corrupting inner tag syntax.
export const applyApplyTag = (template: string, context: Record<string, unknown>): string => {
  // Fast path: no `{% apply %}` tags at all — skip the entire apply expansion.
  if (template.indexOf('{%') === -1) {
    return template;
  }

  let result = template;
  let prev = '';

  // Process inside-out: each iteration finds and replaces the innermost `{% apply %}...{% endapply %}` pair.
  while (prev !== result) {
    prev = result;
    APPLY_TAG.lastIndex = 0;

    let bestStart = -1;
    let bestEnd = -1;
    let bestFilter = '';
    let bestContent = '';

    // Scan for the innermost apply/endapply pair (depth 1 with no nested apply inside).
    const scanText = result;
    let i = 0;
    while (i < scanText.length) {
      APPLY_OPEN.lastIndex = i;
      const openMatch = APPLY_OPEN.exec(scanText);
      if (!openMatch) {
        break;
      }

      const openStart = openMatch.index;
      const openEnd = APPLY_OPEN.lastIndex;

      // Now find the matching {% endapply %} by counting depth.
      let depth = 1;
      const contentStart = openEnd;
      let j = openEnd;
      let foundEnd = false;

      while (j < scanText.length) {
        APPLY_OPEN.lastIndex = j;
        APPLY_CLOSE.lastIndex = j;
        const nextOpen = APPLY_OPEN.exec(scanText);
        const nextClose = APPLY_CLOSE.exec(scanText);

        if (!nextClose) {
          break;
        }

        if (nextOpen && nextOpen.index < nextClose.index) {
          depth++;
          j = APPLY_OPEN.lastIndex;
        } else {
          depth--;
          if (depth === 0) {
            const contentEnd = nextClose.index;
            bestStart = openStart;
            bestEnd = APPLY_CLOSE.lastIndex;
            bestFilter = openMatch[1];
            bestContent = scanText.slice(contentStart, contentEnd);
            foundEnd = true;
            break;
          }
          j = APPLY_CLOSE.lastIndex;
        }
      }

      if (foundEnd) {
        break;
      }

      i = openEnd;
    }

    if (bestStart === -1) {
      break;
    }

    // Process the matched pair: first recursively handle nested applies in the content,
    // then apply the current filter.
    const processedContent = applyApplyTag(bestContent, context);
    const filtersPipe = bestFilter
      .split('|')
      .map(f => f.trim())
      .filter(Boolean)
      .map(f => `| ${f}`)
      .join(' ');
    const filtered = applyFilters(processedContent, filtersPipe, context) as string;

    result = result.slice(0, bestStart) + filtered + result.slice(bestEnd);
  }

  // Fallback: handle any remaining non-nested apply tags via simple regex.
  APPLY_TAG.lastIndex = 0;
  return result.replace(APPLY_TAG, (_full, filtersStr: string, content: string) => {
    const filtersPipe = filtersStr
      .split('|')
      .map(f => f.trim())
      .filter(Boolean)
      .map(f => `| ${f}`)
      .join(' ');
    return applyFilters(content, filtersPipe, context) as string;
  });
};
