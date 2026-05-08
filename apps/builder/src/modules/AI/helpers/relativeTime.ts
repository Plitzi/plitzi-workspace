const relativeTime = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {
    return 'just now';
  }

  if (mins < 60) {
    return `${mins}m`;
  }

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return `${hrs}h`;
  }

  const days = Math.floor(hrs / 24);
  if (days < 7) {
    return `${days}d`;
  }

  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default relativeTime;
