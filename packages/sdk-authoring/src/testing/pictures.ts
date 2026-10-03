/**
 * Two pictures of a page compared in numbers — how much differs, overall and in each part of the page — so an agent
 * reads "footer 2 %, spotlight 14 %" instead of looking at two full screenshots, and opens a picture only where the
 * numbers say something moved.
 *
 * The comparison runs in a browser page (any driver's `evaluate`): a canvas is the one image decoder every driver
 * already has, so this package stays one that installs nothing.
 */

/** A part of the page, by where it is in the picture: the landmarks a page is read by. */
export interface PictureRegion {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PictureDiffInput {
  /** The two pictures, as `data:image/png;base64,…` URLs. */
  a: string;
  b: string;
  regions: PictureRegion[];
  /** How far apart two channels may be and still count as the same pixel (0–255) — anti-aliasing is not a change. */
  tolerance: number;
}

export interface PictureDiff {
  width: number;
  height: number;
  /** The share of pixels that differ, in percent, to one decimal. */
  changed: number;
  regions: { name: string; changed: number }[];
  /** Both pictures beside each other, and the differences in red over a faded copy of the first — PNG data URLs. */
  sideBySide: string;
  diff: string;
}

/** Anything that can run a function in a browser page — Playwright's `Page`, Puppeteer's. */
export interface PictureDriver {
  evaluate<R, A>(fn: (input: A) => R | Promise<R>, input: A): Promise<R>;
}

/** Runs in the page: both pictures decoded on canvases, compared pixel by pixel. Self-contained — it is serialised. */
export const diffPictures = async ({ a, b, regions, tolerance }: PictureDiffInput): Promise<PictureDiff> => {
  const load = (source: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('a picture could not be decoded'));
      image.src = source;
    });
  const [first, second] = await Promise.all([load(a), load(b)]);
  const width = Math.max(first.width, second.width);
  const height = Math.max(first.height, second.height);
  const pixelsOf = (image: HTMLImageElement): Uint8ClampedArray => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('no 2D canvas in this page');
    }

    context.drawImage(image, 0, 0);

    return context.getImageData(0, 0, width, height).data;
  };
  const one = pixelsOf(first);
  const two = pixelsOf(second);

  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = width;
  diffCanvas.height = height;
  const diffContext = diffCanvas.getContext('2d');
  if (!diffContext) {
    throw new Error('no 2D canvas in this page');
  }

  const out = diffContext.createImageData(width, height);
  const differs = new Uint8Array(width * height);
  let changed = 0;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const at = pixel * 4;
    const moved =
      Math.abs(one[at] - two[at]) > tolerance ||
      Math.abs(one[at + 1] - two[at + 1]) > tolerance ||
      Math.abs(one[at + 2] - two[at + 2]) > tolerance ||
      Math.abs(one[at + 3] - two[at + 3]) > tolerance;
    differs[pixel] = moved ? 1 : 0;
    changed += moved ? 1 : 0;
    const grey = Math.round((one[at] + one[at + 1] + one[at + 2]) / 3);
    out.data[at] = moved ? 255 : grey;
    out.data[at + 1] = moved ? 0 : grey;
    out.data[at + 2] = moved ? 0 : grey;
    out.data[at + 3] = moved ? 255 : 60;
  }

  diffContext.putImageData(out, 0, 0);

  const share = (count: number, of: number): number => (of === 0 ? 0 : Math.round((count / of) * 1000) / 10);
  const regionChange = regions.map(region => {
    const left = Math.max(0, Math.floor(region.x));
    const top = Math.max(0, Math.floor(region.y));
    const right = Math.min(width, Math.ceil(region.x + region.width));
    const bottom = Math.min(height, Math.ceil(region.y + region.height));
    let count = 0;
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        count += differs[y * width + x];
      }
    }

    return { name: region.name, changed: share(count, Math.max(0, right - left) * Math.max(0, bottom - top)) };
  });

  const pair = document.createElement('canvas');
  pair.width = width * 2;
  pair.height = height;
  const pairContext = pair.getContext('2d');
  if (!pairContext) {
    throw new Error('no 2D canvas in this page');
  }

  pairContext.drawImage(first, 0, 0);
  pairContext.drawImage(second, width, 0);

  return {
    width,
    height,
    changed: share(changed, width * height),
    regions: regionChange,
    sideBySide: pair.toDataURL('image/png'),
    diff: diffCanvas.toDataURL('image/png')
  };
};

/**
 * Runs in the page that was pictured: its parts, where they are on the full page — its landmarks (header, nav, main,
 * footer, each section and aside), or, on a page that has none, the named blocks right inside the page. Each named by
 * its tag and its id or element name (`section#plans`, `div#hero`). Self-contained — it is serialised.
 */
export const pageRegions = (): PictureRegion[] => {
  const regionOf = (element: Element): PictureRegion[] => {
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) {
      return [];
    }

    const name = element.id || element.getAttribute('data-plitzi-el') || '';

    return [
      {
        name: `${element.tagName.toLowerCase()}${name ? `#${name}` : ''}`,
        x: box.left + window.scrollX,
        y: box.top + window.scrollY,
        width: box.width,
        height: box.height
      }
    ];
  };
  const landmarks = Array.from(document.querySelectorAll('header, nav, main, footer, section, aside')).flatMap(
    regionOf
  );
  if (landmarks.length > 0) {
    return landmarks;
  }

  // The outermost named element is the page; the blocks it is made of are the named ones whose nearest named ancestor
  // it is.
  const named = Array.from(document.querySelectorAll('[data-plitzi-el]'));
  const page = named.at(0);

  return named
    .filter(element => element !== page && element.parentElement?.closest('[data-plitzi-el]') === page)
    .flatMap(regionOf);
};

/** Two pictures compared in a page the driver holds — any page will do, nothing of it is read. */
export const comparePictures = (
  driver: PictureDriver,
  a: string,
  b: string,
  regions: PictureRegion[] = [],
  tolerance = 32
): Promise<PictureDiff> => driver.evaluate(diffPictures, { a, b, regions, tolerance });
