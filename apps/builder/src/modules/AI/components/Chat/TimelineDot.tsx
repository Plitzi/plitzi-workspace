import clsx from 'clsx';

type TimelineDotProps = { role: 'user' | 'assistant'; pulse?: boolean };

const TimelineDot = ({ role, pulse = false }: TimelineDotProps) => {
  return (
    <div
      className={clsx('relative z-10 mt-0.5 h-3 w-3 shrink-0 rounded-full border-2 bg-white dark:bg-zinc-950', {
        'animate-pulse': pulse,
        'border-zinc-400 dark:border-zinc-500': role === 'user',
        'border-orange-400 dark:border-orange-500': role !== 'user'
      })}
    />
  );
};

export default TimelineDot;
