/* eslint-disable react-refresh/only-export-components */
import Contenteditable from '@plitzi/plitzi-ui/ContentEditable';
import clsx from 'clsx';
import { useMemo, use, useCallback } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type TextProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  content?: string | number;
  /**
   * What a pointer resting on it shows — the whole of a text cut short, what an abbreviation stands for. A screen reader
   * may not say it, so nothing only it says should matter.
   */
  title?: string;
  /** Words drawn for the look alone — a seal, a mark — that a screen reader skips, as a decorative container is. */
  decorative?: boolean;
};

const Text = ({ ref, content = 'Text', className = '', title = '', decorative = false }: TextProps) => {
  const { id } = useElement();
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
    <RootElement
      ref={ref}
      className={clsx('plitzi-component__text', className)}
      title={title || undefined}
      {...(decorative ? { 'aria-hidden': true } : {})}
    >
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
