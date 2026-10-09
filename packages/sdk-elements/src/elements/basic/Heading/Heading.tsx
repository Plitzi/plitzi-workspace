/* eslint-disable react-refresh/only-export-components */
import Contenteditable from '@plitzi/plitzi-ui/ContentEditable';
import clsx from 'clsx';

import withElement from '../../../Element/hocs/withElement';
import useEditableContent from '../../../Element/hooks/useEditableContent';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type HeadingProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  content?: string;
  subType?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
};

const Heading = ({ ref, className = '', content = 'Heading', subType = 'h1' }: HeadingProps) => {
  const { previewMode, text, handleChange } = useEditableContent(content);

  return (
    <RootElement
      ref={ref}
      tag={!previewMode ? 'div' : subType}
      className={clsx('plitzi-component__heading', { [`plitzi-component__heading-${subType}`]: subType }, className)}
    >
      {previewMode && text}
      {!previewMode && <Contenteditable value={text} onChange={handleChange} openMode="doubleClick" />}
    </RootElement>
  );
};

export default withElement(Heading);

export { Heading };
