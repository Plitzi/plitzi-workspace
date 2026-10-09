import { use, useCallback, useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

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
    settings: { previewMode },
    contexts: { BuilderContext }
  } = usePlitziServiceContext();
  const builderContext = BuilderContext ? use(BuilderContext) : undefined;
  const text = useMemo(() => contentText(content), [content]);

  const handleChange = useCallback(
    (value: string) => builderContext?.updateElement(id, 'content', value),
    [builderContext, id]
  );

  return { previewMode, text, handleChange };
};

export default useEditableContent;
