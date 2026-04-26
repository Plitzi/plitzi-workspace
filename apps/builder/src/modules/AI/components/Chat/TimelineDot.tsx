type TimelineDotProps = { role: 'user' | 'assistant'; pulse?: boolean };

const TimelineDot = ({ role, pulse = false }: TimelineDotProps) => (
  <div
    className={`relative z-10 mt-0.5 h-3 w-3 shrink-0 rounded-full border-2 bg-white dark:bg-zinc-950 ${
      pulse ? 'animate-pulse' : ''
    } ${role === 'user' ? 'border-emerald-400 dark:border-emerald-500' : 'border-violet-400 dark:border-violet-500'}`}
  />
);

export default TimelineDot;
