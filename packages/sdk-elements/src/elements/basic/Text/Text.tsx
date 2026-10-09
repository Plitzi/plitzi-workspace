/* eslint-disable react-refresh/only-export-components */
import Contenteditable from '@plitzi/plitzi-ui/ContentEditable';
import clsx from 'clsx';

import withElement from '../../../Element/hocs/withElement';
import useEditableContent from '../../../Element/hooks/useEditableContent';
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
  const { previewMode, text, handleChange } = useEditableContent(content);

  return (
    <RootElement
      ref={ref}
      className={clsx('plitzi-component__text', className)}
      title={title || undefined}
      {...(decorative ? { 'aria-hidden': true } : {})}
    >
      {previewMode && text}
      {!previewMode && (
        <Contenteditable
          className="focus-visible:outline-hidden"
          value={text}
          onChange={handleChange}
          openMode="doubleClick"
        />
      )}
    </RootElement>
  );
};

export default withElement(Text);

export { Text };
