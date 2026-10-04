/**
 * Two pictures of a page compared in numbers — how much differs, overall and in each part of the page — so an agent
 * reads "footer 2 %, spotlight 14 %" instead of looking at two full screenshots, and opens a picture only where the
 * numbers say something moved.
 *
 * The pixels are read in a browser page (any driver's `evaluate`): a canvas is the one image decoder every driver
 * already has, so this package stays one that installs nothing. What can be worked out from a little data — where each
 * section of one page sits in the other — is worked out here, in plain functions.
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
  /**
   * For each row of `a`, how far down `b` the same row is (`alignPictures`): each section compared with where it sits
   * in the other picture. Left out, row for row.
   */
  rowShift?: number[];
}

export interface PictureDiff {
  width: number;
  height: number;
  /** The share of pixels that differ, in percent, to one decimal. */
  changed: number;
  /** Each region's share that differs — and, compared aligned, how far down the other picture it sits (`shift`). */
  regions: { name: string; changed: number; shift?: number }[];
  /** Both pictures beside each other, and the differences in red over a faded copy of the first — PNG data URLs. */
  sideBySide: string;
  diff: string;
  /** How tall each picture is. */
  heights: { a: number; b: number };
  /** Compared aligned: the first region the other picture has somewhere else, and how far. */
  driftFrom?: { name: string; shift: number };
  /** Compared aligned: for each row of the first picture, how far down the second the same row is. */
  rowShift?: number[];
}

/** Anything that can run a function in a browser page — Playwright's `Page`, Puppeteer's. */
export interface PictureDriver {
  evaluate<R, A>(fn: (input: A) => R | Promise<R>, input: A): Promise<R>;
}

/** A picture read row by row: each row the mean colour of each of `columns` bands across it, `columns * 3` values. */
export interface RowProfile {
  width: number;
  height: number;
  columns: number;
  rows: number[];
}

/** How many bands a row is read in: enough to tell a heading from a paragraph, few enough to compare fast. */
const PROFILE_COLUMNS = 16;

/** Runs in the page: both pictures read as row profiles, which is what aligning them needs. Self-contained. */
export const profilePictures = async ({
  a,
  b,
  columns
}: {
  a: string;
  b: string;
  columns: number;
}): Promise<{ a: RowProfile; b: RowProfile }> => {
  const profileOf = async (source: string): Promise<RowProfile> => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const loaded = new Image();
      loaded.onload = () => resolve(loaded);
      loaded.onerror = () => reject(new Error('a picture could not be decoded'));
      loaded.src = source;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('no 2D canvas in this page');
    }

    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const rows: number[] = [];
    for (let y = 0; y < image.height; y += 1) {
      for (let band = 0; band < columns; band += 1) {
        const from = Math.floor((band * image.width) / columns);
        const to = Math.max(from + 1, Math.floor(((band + 1) * image.width) / columns));
        const sum = [0, 0, 0];
        for (let x = from; x < to; x += 1) {
          const at = (y * image.width + x) * 4;
          sum[0] += pixels[at];
          sum[1] += pixels[at + 1];
          sum[2] += pixels[at + 2];
        }

        rows.push(...sum.map(channel => Math.round(channel / (to - from))));
      }
    }

    return { width: image.width, height: image.height, columns, rows };
  };

  return { a: await profileOf(a), b: await profileOf(b) };
};

/** How much two rows differ: the mean distance of their bands, 0–255. */
const rowDistance = (a: RowProfile, rowA: number, b: RowProfile, rowB: number): number => {
  const values = a.columns * 3;
  let sum = 0;
  for (let index = 0; index < values; index += 1) {
    sum += Math.abs(a.rows[rowA * values + index] - b.rows[rowB * values + index]);
  }

  return sum / values;
};

/** Two placements that differ by less than this are the same match: a blank band fits anywhere, and stays put. */
const SAME_FIT = 1;

/** The fewest rows a region is compared by: a band of a page is not told by one row. */
const SAMPLED_ROWS = 96;

/**
 * Where a region of `a` sits in `b`: the shift whose rows fit best. Among shifts that fit as well, the one nearest the
 * section before it — a blank band fits anywhere, and the page is likelier to have moved as a block.
 */
const shiftOf = (a: RowProfile, b: RowProfile, top: number, bottom: number, near: number, reach: number): number => {
  const stride = Math.max(1, Math.floor((bottom - top) / SAMPLED_ROWS));
  const sampled: number[] = [];
  for (let row = top; row < bottom; row += stride) {
    sampled.push(row);
  }

  const lowest = 0 - Math.min(top, reach);
  const highest = Math.min(b.height - bottom, reach);
  const fits: { shift: number; cost: number }[] = [];
  for (let shift = lowest; shift <= highest; shift += 1) {
    let cost = 0;
    for (const row of sampled) {
      cost += rowDistance(a, row, b, row + shift);
    }

    fits.push({ shift, cost: cost / sampled.length });
  }

  if (fits.length === 0) {
    return 0;
  }

  const best = Math.min(...fits.map(fit => fit.cost));

  return fits
    .filter(fit => fit.cost <= best + SAME_FIT)
    .reduce((nearest, fit) => (Math.abs(fit.shift - near) < Math.abs(nearest.shift - near) ? fit : nearest)).shift;
};

/** A shift within this is the same place: a pixel or two is rounding, not a page that moved. */
const DRIFT_PX = 2;

export interface PictureAlignment {
  /** For each region, in the order given, how far down `b` its rows are. */
  shifts: number[];
  /** For each row of `a`, how far down `b` the same row is — the smallest region holding the row decides. */
  rowShift: number[];
  /** The first region from the top that `b` has somewhere else, and how far. */
  drift?: { name: string; shift: number };
}

/**
 * Where each region of one picture sits in the other, from their row profiles — so two pages of different heights are
 * compared section by section, not row for row: one section 400 px taller pushes everything under it down, and compared
 * row for row every one of them would differ. Regions are placed from the top down; a row no region holds keeps the
 * shift of the row above it.
 */
export const alignPictures = (a: RowProfile, b: RowProfile, regions: PictureRegion[]): PictureAlignment => {
  // As far as the pages differ in height, and never less than half the shorter one: a block inserted above a footer that
  // fills the screen moves everything below it while both pages measure the same.
  const reach = Math.max(Math.abs(b.height - a.height) + 240, Math.round(Math.min(a.height, b.height) / 2));
  const shifts = regions.map(() => 0);
  // Top down; of two starting together, the inner one first — a section names where a drift starts better than the
  // `main` around it.
  const topDown = regions
    .map((region, index) => ({ region, index }))
    .sort(
      (one, two) =>
        Math.round(one.region.y) - Math.round(two.region.y) ||
        one.region.width * one.region.height - two.region.width * two.region.height
    );
  let near = 0;
  for (const { region, index } of topDown) {
    const top = Math.max(0, Math.floor(region.y));
    const bottom = Math.min(a.height, Math.ceil(region.y + region.height));
    if (bottom <= top) {
      continue;
    }

    const shift = shiftOf(a, b, top, bottom, near, reach);
    shifts[index] = shift;
    near = shift;
  }

  // Told by the innermost regions — a section, not the `main` around it, whose own best fit is a blur of everything in
  // it: the first of them from the top that the other page has somewhere else.
  const inside = (inner: PictureRegion, outer: PictureRegion): boolean =>
    inner !== outer &&
    inner.y >= outer.y &&
    inner.x >= outer.x &&
    inner.y + inner.height <= outer.y + outer.height &&
    inner.x + inner.width <= outer.x + outer.width;
  const moved = topDown.find(
    ({ region, index }) => Math.abs(shifts[index]) > DRIFT_PX && !regions.some(other => inside(other, region))
  );
  const drift = moved ? { name: moved.region.name, shift: shifts[moved.index] } : undefined;

  const rowShift = new Array<number | undefined>(a.height).fill(undefined);
  // Larger regions first, so a section inside a larger one has the last word over its own rows.
  const bySize = regions
    .map((region, index) => ({ region, shift: shifts[index] }))
    .sort((one, two) => two.region.width * two.region.height - one.region.width * one.region.height);
  for (const { region, shift } of bySize) {
    const bottom = Math.min(a.height, Math.ceil(region.y + region.height));
    for (let row = Math.max(0, Math.floor(region.y)); row < bottom; row += 1) {
      rowShift[row] = shift;
    }
  }

  let carried = 0;

  return {
    shifts,
    rowShift: rowShift.map(shift => {
      carried = shift ?? carried;

      return carried;
    }),
    ...(drift ? { drift } : {})
  };
};

/** Runs in the page: both pictures decoded on canvases, compared pixel by pixel. Self-contained — it is serialised. */
export const diffPictures = async ({ a, b, regions, tolerance, rowShift }: PictureDiffInput): Promise<PictureDiff> => {
  const load = (source: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('a picture could not be decoded'));
      image.src = source;
    });
  const [first, second] = await Promise.all([load(a), load(b)]);
  const width = Math.max(first.width, second.width);
  // Aligned, the comparison is told in the first picture's rows; row for row, it covers both.
  const height = rowShift ? first.height : Math.max(first.height, second.height);
  const pixelsOf = (image: HTMLImageElement, rows: number): Uint8ClampedArray => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = rows;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('no 2D canvas in this page');
    }

    context.drawImage(image, 0, 0);

    return context.getImageData(0, 0, width, rows).data;
  };
  const otherHeight = rowShift ? second.height : height;
  const one = pixelsOf(first, height);
  const two = pixelsOf(second, otherHeight);

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
  for (let y = 0; y < height; y += 1) {
    const otherRow = y + (rowShift?.[y] ?? 0);
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 4;
      const there = (otherRow * width + x) * 4;
      // A row the other picture does not have — past its end — is a difference, not a match with nothing.
      const moved =
        otherRow < 0 ||
        otherRow >= otherHeight ||
        Math.abs(one[at] - two[there]) > tolerance ||
        Math.abs(one[at + 1] - two[there + 1]) > tolerance ||
        Math.abs(one[at + 2] - two[there + 2]) > tolerance ||
        Math.abs(one[at + 3] - two[there + 3]) > tolerance;
      differs[y * width + x] = moved ? 1 : 0;
      changed += moved ? 1 : 0;
      const grey = Math.round((one[at] + one[at + 1] + one[at + 2]) / 3);
      out.data[at] = moved ? 255 : grey;
      out.data[at + 1] = moved ? 0 : grey;
      out.data[at + 2] = moved ? 0 : grey;
      out.data[at + 3] = moved ? 255 : 60;
    }
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
  pair.height = Math.max(first.height, second.height);
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
    diff: diffCanvas.toDataURL('image/png'),
    heights: { a: first.height, b: second.height }
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

export interface CompareOptions {
  /** The parts of the page a difference is told by (`pageRegions`). */
  regions?: PictureRegion[];
  /** How far apart two channels may be and still count as the same pixel (0–255); 32 by default. */
  tolerance?: number;
  /**
   * Whether each region is compared with where it sits in the second picture rather than row for row — for two
   * different pages, which seldom measure the same; never for two frames of one page, which do.
   */
  align?: boolean;
}

/** Two pictures compared in a page the driver holds — any page will do, nothing of it is read. */
export const comparePictures = async (
  driver: PictureDriver,
  a: string,
  b: string,
  { regions = [], tolerance = 32, align = false }: CompareOptions = {}
): Promise<PictureDiff> => {
  if (!align) {
    return driver.evaluate(diffPictures, { a, b, regions, tolerance });
  }

  const profiles = await driver.evaluate(profilePictures, { a, b, columns: PROFILE_COLUMNS });
  const { shifts, rowShift, drift } = alignPictures(profiles.a, profiles.b, regions);
  const diff = await driver.evaluate(diffPictures, { a, b, regions, tolerance, rowShift });

  return {
    ...diff,
    regions: diff.regions.map((region, index) => ({ ...region, shift: shifts[index] })),
    rowShift,
    ...(drift ? { driftFrom: drift } : {})
  };
};
