/* eslint-disable react-refresh/only-export-components */
import Contenteditable from '@plitzi/plitzi-ui/ContentEditable';
import classNames from 'classnames';
import React, { useMemo, use, useCallback } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { InternalProps } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type TextProps = {
  ref?: RefObject<HTMLElement>;
  internalProps?: InternalProps;
  className?: string;
  content?: string | number;
};

const Text = ({ ref, content = 'Text', className = '', internalProps = emptyObject as InternalProps }: TextProps) => {
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
    (value: string) => builderContext?.updateElement(internalProps.id, 'content', value),
    [builderContext, internalProps.id]
  );

  return (
    <RootElement ref={ref} internalProps={internalProps} className={classNames('plitzi-component__text', className)}>
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
