import clsx from 'clsx';

import { formatMs, formatPercent, frameColor, frameTextColor, HATCH_STYLE } from '../../helpers';

import type { FlameNode } from '../../helpers';
import type { CSSProperties } from 'react';

export const ROW_HEIGHT = 18;

export type FlameFrameProps = {
  node: FlameNode;
  left: number;
  width: number;
  top: number;
  selected: boolean;
  onClick: (node: FlameNode) => void;
};

const FlameFrame = ({ node, left, width, top, selected, onClick }: FlameFrameProps) => {
  const style: CSSProperties = {
    left: `${left}%`,
    width: `${width}%`,
    top,
    height: ROW_HEIGHT,
    // Stripes alone vanish on tiny frames, so non-rendered nodes also carry a faint solid fill (set below).
    ...(node.state === 'hatched' && !selected ? HATCH_STYLE : undefined)
  };

  // Selection is a solid violet fill (the panel accent), not a border — so the neutral 1px separators stay intact.
  const background = selected
    ? 'bg-violet-600'
    : node.state === 'hatched'
      ? 'bg-zinc-200 dark:bg-zinc-800'
      : frameColor(node);

  return (
    <button
      type="button"
      onClick={() => onClick(node)}
      title={`${node.name} (${node.type})${node.visible ? '' : ' · hidden'}\n${formatMs(node.selfDuration)} self · ${formatMs(node.actualDuration)} total · ${formatPercent(node.baseDuration > 0 ? node.width : 0)} width`}
      style={style}
      className={clsx(
        'absolute flex cursor-pointer items-center gap-1 overflow-hidden rounded-[1px] border border-zinc-50 px-1 text-left text-[11px] leading-none whitespace-nowrap dark:border-zinc-900',
        background,
        selected ? 'z-10 text-white' : clsx(frameTextColor(node), 'hover:brightness-110')
      )}
    >
      {node.trigger && <i className="fa-solid fa-bolt shrink-0 text-[8px] text-violet-200" />}
      {!node.visible && <i className="fa-solid fa-eye-slash shrink-0 text-[8px] opacity-80" />}
      <span className="truncate">{node.name}</span>
    </button>
  );
};

export default FlameFrame;
