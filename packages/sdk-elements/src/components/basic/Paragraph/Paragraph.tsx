/* eslint-disable react-refresh/only-export-components */
import Contenteditable from '@plitzi/plitzi-ui/ContentEditable';
import classNames from 'classnames';
import { useMemo, use, useCallback } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalProps } from '../../../types/ElementTypes';
import type { RefObject } from 'react';

export type ParagraphProps = {
  ref: RefObject<HTMLElement>;
  internalProps: InternalProps;
  content: string | number;
  className: string;
};

const Paragraph = ({
  ref,
  content = 'Paragraph',
  className = '',
  internalProps = emptyObject as InternalProps
}: ParagraphProps) => {
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
    (value: string) => builderContext?.updateElement(internalProps.id, 'content', value),
    [builderContext, internalProps.id]
  );

  return (
    <RootElement
      ref={ref}
      tag={!previewMode ? 'div' : 'p'}
      internalProps={internalProps}
      className={classNames('plitzi-component__paragraph', className)}
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
