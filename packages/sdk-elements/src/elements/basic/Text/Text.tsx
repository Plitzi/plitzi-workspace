/* eslint-disable react-refresh/only-export-components */
import Contenteditable from '@plitzi/plitzi-ui/ContentEditable';
import clsx from 'clsx';
import { useMemo, use, useCallback } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type TextProps = {
  id: string;
  ref?: RefObject<HTMLElement>;
  className?: string;
  content?: string | number;
};

const Text = ({ id, ref, content = 'Text', className = '' }: TextProps) => {
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
      return 'Text';
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
    <RootElement id={id} ref={ref} className={clsx('plitzi-component__text', className)}>
      {previewMode && finalContent}
      {!previewMode && (
        <Contenteditable
          className="focus-visible:outline-hidden"
          value={finalContent}
          onChange={handleChange}
          openMode="doubleClick"
        />
      )}
    </RootElement>
  );
};

export default withElement(Text);

export { Text };
