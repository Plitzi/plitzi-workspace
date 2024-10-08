const processContainer = (elementDOM, iframeDOM, zoom) => {
  let scrollY = 0;
  let scrollX = 0;
  let innerHeight = 0;
  let innerWidth = 0;
  if (iframeDOM) {
    ({ scrollY, innerHeight, innerWidth } = iframeDOM.contentWindow);
    const [{ scrollLeft, scrollTop }] = iframeDOM.contentWindow.document.getElementsByClassName('builder-iframe');
    if (scrollLeft !== 0 && scrollX === 0) {
      scrollX = scrollLeft;
    }

    if (scrollTop !== 0 && scrollY === 0) {
      scrollY = scrollTop;
    }
  } else {
    ({ scrollX, scrollY, innerHeight, innerWidth } = window);
  }

  if (!elementDOM) {
    return undefined;
  }

  const { width, height, top, left } = elementDOM.getBoundingClientRect();

  return {
    width: width / zoom,
    height: height / zoom,
    x: (left + scrollX) / zoom,
    y: (top + scrollY) / zoom,
    scrollX,
    scrollY,
    innerHeight: innerHeight / zoom,
    innerWidth: innerWidth / zoom,
    rounded: {
      width: Math.round(width),
      height: Math.round(height)
    }
  };
};

export { processContainer };
