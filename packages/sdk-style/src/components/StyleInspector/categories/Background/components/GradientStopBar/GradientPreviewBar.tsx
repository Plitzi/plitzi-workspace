import { use, useMemo } from 'react';

import { CHECKERBOARD } from '../../../../components/ColorSwatch/helpers';
import { resolveTokens } from '../../../../cssValues';
import StyleInspectorContext from '../../../../StyleInspectorContext';

import type { MouseEvent, ReactNode } from 'react';

type GradientPreviewBarProps = {
  gradientCSS: string;
  children?: ReactNode;
  onClick: (e: MouseEvent<HTMLDivElement>) => void;
};

/** The stops drawn on a bar over a checkerboard, with their handles on it; a click on the bar adds a stop there. */
const GradientPreviewBar = ({ gradientCSS, children, onClick }: GradientPreviewBarProps) => {
  const { variables } = use(StyleInspectorContext);
  const background = useMemo(() => ({ background: resolveTokens(gradientCSS, variables) }), [gradientCSS, variables]);

  return (
    <div
      className="relative h-7 w-full cursor-copy rounded-md ring-1 ring-black/15 ring-inset dark:ring-white/20"
      style={CHECKERBOARD}
      title="Click the bar to add a stop"
      onClick={onClick}
    >
      <div className="absolute inset-0 rounded-md" style={background} />
      {children}
    </div>
  );
};

export default GradientPreviewBar;
