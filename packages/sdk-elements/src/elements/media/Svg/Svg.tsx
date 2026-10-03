/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import { fitSvg, isSvgMarkup, sanitizeSvg } from './sanitizeSvg';
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { RefObject } from 'react';

export type SvgProps = {
  ref?: RefObject<HTMLElement>;
  /** The drawing: one `<svg>…</svg>`, filling the box its class sizes; with `currentColor`, it takes the class's colour. */
  content?: string;
  /** What the drawing means, for one that means something; without it the drawing is decoration, hidden from readers. */
  label?: string;
  className?: string;
};

const Svg = ({ ref, content = '', label = '', className = '' }: SvgProps) => {
  const {
    settings: { previewMode }
  } = usePlitziServiceContext();
  const markup = useMemo(() => (isSvgMarkup(content) ? fitSvg(sanitizeSvg(content)) : ''), [content]);
  const meaning = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };

  if (!markup && !previewMode) {
    return (
      <RootElement ref={ref} className={clsx('plitzi-component__svg svg--empty', className)}>
        Paste one {'<svg>…</svg>'} here
      </RootElement>
    );
  }

  return (
    <RootElement
      tag="span"
      ref={ref}
      className={clsx('plitzi-component__svg', className)}
      {...meaning}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
};

export default withElement(Svg);

export { Svg };
