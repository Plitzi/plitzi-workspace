import type { CompressedBodies } from '@plitzi/sdk-shared';

type Entry = { version: string; bodies: CompressedBodies };

const sizeOf = (bodies: CompressedBodies): number => (bodies.br?.length ?? 0) + (bodies.gzip?.length ?? 0);

/**
 * The compressed forms of static files, one entry per file, within a byte budget.
 *
 * A file is compressed once per version and encoding instead of on every request — the SDK bundle alone is megabytes
 * of JavaScript. Keyed by path with the version beside it, so a file that changed replaces its old forms rather than
 * sitting next to them. Past the budget the least recently served files go first.
 */
export class CompressedFileCache {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly maxBytes: number) {}

  /** Where the compressed forms of this version of the file are kept; `send` fills it as encodings are asked for. */
  storeFor(filePath: string, version: string): CompressedBodies {
    const existing = this.entries.get(filePath);
    this.entries.delete(filePath);
    const entry = existing?.version === version ? existing : { version, bodies: {} };
    this.entries.set(filePath, entry);

    return entry.bodies;
  }

  /** Drops the least recently served files until the rest fit the budget. Called after a send may have grown one. */
  trim(): void {
    let total = 0;
    for (const entry of this.entries.values()) {
      total += sizeOf(entry.bodies);
    }

    for (const [filePath, entry] of this.entries) {
      if (total <= this.maxBytes) {
        return;
      }

      total -= sizeOf(entry.bodies);
      this.entries.delete(filePath);
    }
  }

  get bytes(): number {
    let total = 0;
    for (const entry of this.entries.values()) {
      total += sizeOf(entry.bodies);
    }

    return total;
  }
}
