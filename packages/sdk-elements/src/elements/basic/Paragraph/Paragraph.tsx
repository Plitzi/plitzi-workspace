/* eslint-disable react-refresh/only-export-components */
import Contenteditable from '@plitzi/plitzi-ui/ContentEditable';
import clsx from 'clsx';

import withElement from '../../../Element/hocs/withElement';
import useEditableContent from '../../../Element/hooks/useEditableContent';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type ParagraphProps = {
  ref?: RefObject<HTMLElement>;
  content?: string | number;
  className?: string;
};

const Paragraph = ({ ref, content = 'Paragraph', className = '' }: ParagraphProps) => {
  const { previewMode, text, handleChange } = useEditableContent(content);

  return (
    <RootElement ref={ref} tag={!previewMode ? 'div' : 'p'} className={clsx('plitzi-component__paragraph', className)}>
      {previewMode && text}
      {!previewMode && <Contenteditable className="" value={text} onChange={handleChange} openMode="doubleClick" />}
    </RootElement>
  );
};

export default withElement(Paragraph);

export { Paragraph };
