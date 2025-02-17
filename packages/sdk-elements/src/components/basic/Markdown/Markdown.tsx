/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import MarkdownUI from '@plitzi/plitzi-ui-components/Markdown/index';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalProps } from '../../../types/ElementTypes';
import type { RefObject } from 'react';

export type MarkdownProps = {
  ref: RefObject<HTMLElement>;
  internalProps: InternalProps;
  className: string;
  content: string;
};

const Markdown = ({
  ref,
  content = 'Markdown',
  className = '',
  internalProps = emptyObject as InternalProps
}: MarkdownProps) => {
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames(
        'plitzi-component__markdown',
        { 'plitzi-component__markdown--edit-mode': !previewMode },
        className
      )}
    >
      <MarkdownUI>{content}</MarkdownUI>
    </RootElement>
  );
};

export default withElement(Markdown);

export { Markdown };
