const mongoObjectId = () => {
  const timestamp = ((new Date().getTime() / 1000) | 0).toString(16);

  return (
    timestamp +
    'xxxxxxxxxxxxxxxx'
      .replace(/[x]/g, function () {
        return ((Math.random() * 16) | 0).toString(16);
      })
      .toLowerCase()
  );
};

export const generateID = () => mongoObjectId();

export const isInViewport = (el: HTMLElement) => {
  const rect = el.getBoundingClientRect();
  const { top, left, bottom, right } = rect;
  const { innerHeight, innerWidth } = window;
  const {
    documentElement: { clientHeight, clientWidth }
  } = document;

  return top >= 0 && left >= 0 && bottom <= (innerHeight || clientHeight) && right <= (innerWidth || clientWidth);
};

export const isUrl = (str: string) => {
  const regexp = /^(https?:\/\/)?([\da-z.-]+\.[a-z.]{2,6}|[\d.]+)([/:?=&#]{1}[\da-zA-Z. :|;-]+)*[/?]?$/gim;
  if (regexp.test(str)) {
    return true;
  }

  return false;
};

export const hexToRGB = (hex: string, alpha: number) => {
  if (!hex) {
    return false;
  }

  let r;
  let g;
  let b;
  if (hex.length === 7) {
    [r, g, b] = (hex.match(/\w\w/g) ?? []).map((x: string) => parseInt(x, 16));
  } else if (hex.length === 4) {
    [r, g, b] = (hex.match(/\w/g) ?? []).map((x: string) => parseInt(`${x}${x}`, 16));
  } else {
    return false;
  }

  if (alpha) {
    return `rgba(${r},${g},${b},${alpha})`;
  }

  return `rgb(${r},${g},${b})`;
};
