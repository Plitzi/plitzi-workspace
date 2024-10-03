// Packages
import React from 'react';
import classNames from 'classnames';
import MarkdownUI from '@plitzi/plitzi-ui-components/Markdown';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import RootElement from '../../../Element/RootElement';
import withElement from '../../../Element/hocs/withElement';

// Styles

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   internalProps: object;
 *   className: string;
 *   content: string | number;
 * }} props
 * @returns {React.ReactElement}
 */
const Markdown = props => {
  const { ref, content = 'Markdown', className = '', internalProps = emptyObject } = props;
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames('plitzi-component__markdown', { 'plitzi-component__markdown--edit-mode': !previewMode }, className)}
    >
      <MarkdownUI>{content}</MarkdownUI>
    </RootElement>
  );
};

export default withElement(Markdown);

export { Markdown };
