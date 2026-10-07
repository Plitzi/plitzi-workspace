import { MARKDOWN_PARTS } from '@plitzi/plitzi-ui/Markdown';

import useStableValue from '@plitzi/sdk-shared/hooks/useStableValue';

import type { MarkdownClassNames } from '@plitzi/plitzi-ui/Markdown';

/**
 * The class of each part of a Markdown document, read off the element's slots of the same names — the same object
 * while the classes stay the same: a new one rebuilds every tag of the document.
 */
const useMarkdownClassNames = (styleSelectors: Readonly<Partial<Record<string, string>>>): MarkdownClassNames => {
  const classNames: MarkdownClassNames = {};
  for (const part of MARKDOWN_PARTS) {
    const className = styleSelectors[part];
    if (className) {
      classNames[part] = className;
    }
  }

  return useStableValue(classNames);
};

export default useMarkdownClassNames;
