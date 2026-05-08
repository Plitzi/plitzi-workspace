const getDateGroup = (dateStr: string): 'today' | 'yesterday' | 'week' | 'older' => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = diff / 86400000;
  if (days < 1) {
    return 'today';
  }
  if (days < 2) {
    return 'yesterday';
  }
  if (days < 7) {
    return 'week';
  }

  return 'older';
};

export default getDateGroup;
