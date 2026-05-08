export const formatTime = (ts: number = 0) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
