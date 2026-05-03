const formatRetryDelay = (ts: number): string => {
  const ms = ts - Date.now();
  if (ms <= 0) {
    return 'now';
  }

  const totalSecs = Math.ceil(ms / 1000);
  if (totalSecs < 60) {
    return `in ${String(totalSecs)}s`;
  }

  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins < 60) {
    return `in ${String(mins)}m ${String(secs)}s`;
  }

  return `at ${new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

export default formatRetryDelay;
