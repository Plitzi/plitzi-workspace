import { useEffect, useState } from 'react';

import formatRetryDelay from './helpers/formatRetryDelay';

export type QuotaCountdownProps = { retryAfter: number };

const QuotaCountdown = ({ retryAfter }: QuotaCountdownProps) => {
  const [label, setLabel] = useState(() => formatRetryDelay(retryAfter));

  useEffect(() => {
    setLabel(formatRetryDelay(retryAfter));
    const id = setInterval(() => {
      const next = formatRetryDelay(retryAfter);
      setLabel(next);
      if (next === 'now') {
        clearInterval(id);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [retryAfter]);

  return <span className="ml-2 opacity-75">· resets {label}</span>;
};

export default QuotaCountdown;
