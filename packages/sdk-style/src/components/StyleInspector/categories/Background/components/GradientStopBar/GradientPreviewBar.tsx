import type { MouseEvent } from 'react';

type GradientPreviewBarProps = {
  gradientCSS: string;
  onClick: (e: MouseEvent<HTMLDivElement>) => void;
};

const GradientPreviewBar = ({ gradientCSS, onClick }: GradientPreviewBarProps) => (
  <div
    className="relative h-6 w-full cursor-crosshair overflow-hidden rounded-sm border border-gray-300 dark:border-zinc-600"
    onClick={onClick}
    title="Click to add a color stop"
  >
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          'linear-gradient(45deg,#ccc 25%,transparent 25%),' +
          'linear-gradient(-45deg,#ccc 25%,transparent 25%),' +
          'linear-gradient(45deg,transparent 75%,#ccc 75%),' +
          'linear-gradient(-45deg,transparent 75%,#ccc 75%)',
        backgroundSize: '10px 10px',
        backgroundPosition: '0 0,0 5px,5px -5px,-5px 0'
      }}
    />
    <div className="absolute inset-0" style={{ background: gradientCSS }} />
  </div>
);

export default GradientPreviewBar;
