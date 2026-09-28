/**
 * When a runtime stops by itself, in the viewer's own time: with its day, since an idle time counted in days puts it
 * well past today.
 */
const stopMomentOf = (seconds: number): string =>
  new Date(seconds * 1000).toLocaleString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

export default stopMomentOf;
