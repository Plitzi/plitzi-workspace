import { use, useCallback, useMemo } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import usePlitzi from '@plitzi/sdk-shared/hooks/usePlitzi';

import useElement from './useElement';

/** A `content` as the words drawn: a number written out, nothing as nothing, anything else that is not text as its JSON. */
export const contentText = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (typeof content === 'number') {
    return `${content}`;
  }

  if (content === undefined || content === null) {
    return '';
  }

  return JSON.stringify(content);
};

/**
 * A text element's words: drawn on a page, and edited in place in the builder — double-click, type — each change
 * written back to the element's `content`.
 */
const useEditableContent = (content: unknown) => {
  const { id } = useElement();
  const {
    settings: { previewMode }
  } = usePlitzi();
  const builderContext = use(BuilderContext);
  const text = useMemo(() => contentText(content), [content]);

  // Only the editor writes, and it is drawn only while editing — inside the builder, whose context this then is.
  const handleChange = useCallback(
    (value: string) => {
      if (!previewMode) {
        builderContext.updateElement(id, 'content', value);
      }
    },
    [builderContext, id, previewMode]
  );

  return { previewMode, text, handleChange };
};

export default useEditableContent;
