/* eslint-disable react-refresh/only-export-components */
import Contenteditable from '@plitzi/plitzi-ui/ContentEditable';
import clsx from 'clsx';
import { useMemo, use, useCallback } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type ParagraphProps = {
  id: string;
  ref?: RefObject<HTMLElement>;
  content?: string | number;
  className?: string;
};

const Paragraph = ({ id, ref, content = 'Paragraph', className = '' }: ParagraphProps) => {
  const {
    settings: { previewMode },
    contexts: { BuilderContext }
  } = usePlitziServiceContext();
  const builderContext = BuilderContext ? use(BuilderContext) : undefined;
  const finalContent = useMemo(() => {
    if (typeof content !== 'string' && typeof content !== 'number') {
      return JSON.stringify(content);
    }

    if (!content && content !== '' && !previewMode) {
      return 'Paragraph';
    }

    if (typeof content === 'number') {
      return `${content}`;
    }

    return content;
  }, [content, previewMode]);

  const handleChange = useCallback(
    (value: string) => builderContext?.updateElement(id, 'content', value),
    [builderContext, id]
  );

  return (
    <RootElement
      id={id}
      ref={ref}
      tag={!previewMode ? 'div' : 'p'}
      className={clsx('plitzi-component__paragraph', className)}
    >
      {previewMode && finalContent}
      {!previewMode && (
        <Contenteditable className="" value={finalContent} onChange={handleChange} openMode="doubleClick" />
      )}
    </RootElement>
  );
};

export default withElement(Paragraph);

export { Paragraph };
