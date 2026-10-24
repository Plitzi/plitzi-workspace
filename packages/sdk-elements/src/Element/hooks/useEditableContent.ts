import { use, useCallback, useMemo } from 'react';

import { BuilderContext } from '@plitzi/sdk-shared/builder/contexts';
import { usePlitzi } from '@plitzi/sdk-shared/hooks';

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
 * What says on the page that an element has nothing to show — no words, no picture: a binding that read nothing, a
 * field the data lacks. Drawn empty, never as a placeholder a visitor reads (encore's room cards said "Text"); the
 * marker is how a page check tells it from an element left empty on purpose (`page check`, `element-empty`).
 */
export const emptyMark = (empty: boolean): { 'data-plitzi-empty'?: '' } => (empty ? { 'data-plitzi-empty': '' } : {});

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

  return { previewMode, text, handleChange, emptyMark: emptyMark(previewMode === true && text === '') };
};

export default useEditableContent;
