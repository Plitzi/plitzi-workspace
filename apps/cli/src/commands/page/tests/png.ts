import { deflateSync } from 'node:zlib';

/** A PNG as a browser writes one: 8-bit RGBA, each row filtered as given (0 none, 1 sub, 2 up, 4 Paeth). */
export const pngOf = (
  width: number,
  height: number,
  pixel: (x: number, y: number) => number[],
  filter = 0
): Uint8Array => {
  const chunk = (kind: string, body: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);

    return Buffer.concat([length, Buffer.from(kind, 'ascii'), body, Buffer.alloc(4)]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows: number[] = [];
  const at = (x: number, y: number, channel: number): number => (x < 0 || y < 0 ? 0 : (pixel(x, y)[channel] ?? 0));
  for (let y = 0; y < height; y += 1) {
    rows.push(filter);
    for (let x = 0; x < width; x += 1) {
      for (let channel = 0; channel < 4; channel += 1) {
        const value = at(x, y, channel);
        const predicted = filter === 1 ? at(x - 1, y, channel) : filter === 2 ? at(x, y - 1, channel) : 0;
        rows.push((value - predicted + 256) & 255);
      }
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from(rows))),
    chunk('IEND', Buffer.alloc(0))
  ]);
};
