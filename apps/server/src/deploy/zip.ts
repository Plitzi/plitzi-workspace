import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

import { contentTypeOf } from './contentType';

import type { SiteFile } from './types';

/**
 * A site as one zip and back (PKWARE APPNOTE, the subset every unzip reads): what a person downloads to host by hand,
 * what Amplify takes as a deploy, and how a deploy's artifact is kept for a rollback that ships it again (§7). Deflated
 * where that saves bytes, stored where it does not (images and fonts are compressed already). No ZIP64: a site past
 * 4 GB or 65,535 files is refused with why, never written broken.
 */

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL = 0x06054b50;
const STORED = 0;
const DEFLATED = 8;
/** "Version needed to extract": 2.0, deflate. */
const VERSION = 20;
/** Bit 11: names are UTF-8. */
const UTF8 = 0x0800;
const MAX_FILES = 0xffff;
const MAX_BYTES = 0xffffffff;
/** 1980-01-01 00:00 in DOS time: every entry carries the same, so the same site is always the same zip. */
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

/** A site's files as one zip, the same bytes for the same files. */
export const zipFiles = (files: SiteFile[]): Uint8Array => {
  if (files.length > MAX_FILES) {
    throw new Error(`A zip holds at most ${String(MAX_FILES)} files; this site has ${String(files.length)}`);
  }

  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.path, 'utf8');
    const raw = Buffer.from(file.body);
    const deflated = deflateRawSync(raw);
    const method = deflated.length < raw.length ? DEFLATED : STORED;
    const data = method === DEFLATED ? deflated : raw;
    const checksum = crc32(raw);
    if (offset + 30 + name.length + data.length > MAX_BYTES) {
      throw new Error('A zip holds at most 4 GB; this site is larger');
    }

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_HEADER, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(UTF8, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_HEADER, 0);
    // Made by Unix (3), so the permissions below are read.
    central.writeUInt16LE((3 << 8) | VERSION, 4);
    central.writeUInt16LE(VERSION, 6);
    central.writeUInt16LE(UTF8, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    // Extra field, comment, disk number, internal attributes: none.
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);

    locals.push(local, name, data);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);

  return new Uint8Array(Buffer.concat([...locals, directory, end]));
};

/**
 * The files of a zip this module wrote (or any zip of the same subset: no ZIP64, no encryption, stored or deflated).
 * Anything else is refused with what it is, never read half.
 */
export const unzipFiles = (
  zip: Uint8Array,
  cache: (path: string) => SiteFile['cache'] = () => 'revalidate'
): SiteFile[] => {
  const bytes = Buffer.from(zip);
  const endAt = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endAt < 0) {
    throw new Error('Not a zip: it has no central directory');
  }

  const count = bytes.readUInt16LE(endAt + 10);
  let at = bytes.readUInt32LE(endAt + 16);
  const files: SiteFile[] = [];

  for (let index = 0; index < count; index += 1) {
    if (bytes.readUInt32LE(at) !== CENTRAL_HEADER) {
      throw new Error(`The zip's directory is broken at entry ${String(index + 1)}`);
    }

    const flags = bytes.readUInt16LE(at + 8);
    const method = bytes.readUInt16LE(at + 10);
    const size = bytes.readUInt32LE(at + 20);
    const nameLength = bytes.readUInt16LE(at + 28);
    const extraLength = bytes.readUInt16LE(at + 30);
    const commentLength = bytes.readUInt16LE(at + 32);
    const localAt = bytes.readUInt32LE(at + 42);
    const path = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    if (flags & 0x1) {
      throw new Error(`${path} is encrypted, and a site's files never are`);
    }

    const dataAt = localAt + 30 + bytes.readUInt16LE(localAt + 26) + bytes.readUInt16LE(localAt + 28);
    const data = bytes.subarray(dataAt, dataAt + size);
    if (method !== STORED && method !== DEFLATED) {
      throw new Error(`${path} is compressed with method ${String(method)}, which only stored and deflated zips use`);
    }

    if (!path.endsWith('/')) {
      const body = method === DEFLATED ? inflateRawSync(data) : data;
      files.push({ path, body: new Uint8Array(body), type: contentTypeOf(path), cache: cache(path) });
    }

    at += 46 + nameLength + extraLength + commentLength;
  }

  return files;
};
