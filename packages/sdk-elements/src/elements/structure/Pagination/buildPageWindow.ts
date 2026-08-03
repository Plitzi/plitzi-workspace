/**
 * The run of page numbers to show around the current page.
 *
 * A provider that reports no total has no page count, and a numbered pager cannot be invented from that — the
 * window is empty and prev/next carry the whole interaction. That is the honest rendering of "we know there is
 * more, we do not know how much".
 */
const buildPageWindow = (page: number, pageCount: number, windowSize: number): number[] => {
  if (pageCount <= 0 || windowSize <= 0) {
    return [];
  }

  const size = Math.min(windowSize, pageCount);
  const start = Math.min(Math.max(page - Math.floor(size / 2), 1), pageCount - size + 1);

  return Array.from({ length: size }, (_item, index) => start + index);
};

export default buildPageWindow;
