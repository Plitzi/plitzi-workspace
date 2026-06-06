import { useId } from 'react';

type LogoProps = {
  size?: number;
  className?: string;
  title?: string;
};

// The nexus mark: a central hub node (the single source of truth) with six satellite nodes wired to it through a
// faint mesh — a global store at the center, fine-grained paths radiating out to every subscriber.
const NODES: ReadonlyArray<readonly [number, number]> = [
  [16, 7.5],
  [23.4, 11.75],
  [23.4, 20.25],
  [16, 24.5],
  [8.6, 20.25],
  [8.6, 11.75]
];

const Logo = ({ size = 32, className, title = '@plitzi/nexus logo' }: LogoProps) => {
  const gradientId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>

      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />

      <g stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M16 7.5 23.4 11.75 23.4 20.25 16 24.5 8.6 20.25 8.6 11.75 Z"
          strokeWidth="1.3"
          strokeOpacity="0.45"
        />
        <g strokeWidth="1.5">
          {NODES.map(([x, y]) => (
            <line key={`${x}-${y}`} x1="16" y1="16" x2={x} y2={y} />
          ))}
        </g>
      </g>

      <g fill="#fff">
        {NODES.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.7" />
        ))}
        <circle cx="16" cy="16" r="2.6" />
      </g>
    </svg>
  );
};

export default Logo;
