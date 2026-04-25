/* eslint-disable react-refresh/only-export-components */
import Contenteditable from '@plitzi/plitzi-ui/ContentEditable';
import clsx from 'clsx';
import { useMemo, use, useCallback } from 'react';

import useElement from '@plitzi/sdk-shared/elements/hooks/useElement';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type HeadingProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  content?: string;
  subType?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
};

const Heading = ({ ref, className = '', content = 'Heading', subType = 'h1' }: HeadingProps) => {
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
      return 'Heading';
    }

    return content;
  }, [content, previewMode]);

  const handleChange = useCallback(
    (value: string) => !previewMode && builderContext?.updateElement(id, 'content', value),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [builderContext?.updateElement, id]
  );

  return (
    <RootElement
      ref={ref}
      tag={!previewMode ? 'div' : subType}
      className={clsx('plitzi-component__heading', { [`plitzi-component__heading-${subType}`]: subType }, className)}
    >
      {previewMode && finalContent}
      {!previewMode && <Contenteditable value={finalContent} onChange={handleChange} openMode="doubleClick" />}
    </RootElement>
  );
};

export default withElement(Heading);

export { Heading };
