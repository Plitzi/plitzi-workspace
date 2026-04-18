import fs from 'node:fs/promises';
import path from 'node:path';

import { compilePlugin } from './compile';
import { copyPlugin } from './copy';
import { detectAction, isComponentSource } from './detect';

import type { PluginEntry, PluginSource } from '../types';

const META_FILE = 'meta.json';
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_CACHE_DIR = '.sdk-plugins';

type Meta = { compiledAt: number };

type CacheEntry = { compiledAt: number; entry: PluginEntry };

export class PluginManager {
  readonly urlPrefix = '/sdk-plugins';
  readonly outputDir: string;

  private readonly plugins: Record<string, PluginSource>;
  private readonly ttlMs: number;
  private readonly mem = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<PluginEntry | null>>();

  constructor(plugins: Record<string, PluginSource>, cacheDir?: string, ttlMs?: number) {
    this.plugins = plugins;
    this.outputDir = path.resolve(process.cwd(), cacheDir ?? DEFAULT_CACHE_DIR);
    this.ttlMs = ttlMs ?? DEFAULT_TTL_MS;
  }

  hasPlugin(name: string): boolean {
    return name in this.plugins;
  }

  register(name: string, source: PluginSource): void {
    this.plugins[name] = source;
    this.mem.delete(name);
  }

  private pluginDir(name: string): string {
    return path.join(this.outputDir, name);
  }

  private isExpired(compiledAt: number): boolean {
    return Date.now() - compiledAt > this.ttlMs;
  }

  private toEntry(name: string, hasJS: boolean, hasCSS: boolean): PluginEntry {
    return {
      name,
      js: hasJS ? `${this.urlPrefix}/${name}/index.js` : undefined,
      css: hasCSS ? `${this.urlPrefix}/${name}/index.css` : undefined
    };
  }

  async prepare(name: string): Promise<PluginEntry | null> {
    const inflight = this.inflight.get(name);
    if (inflight !== undefined) {
      return inflight;
    }

    const source = this.plugins[name] as PluginSource | undefined;
    if (source === undefined) {
      return null;
    }

    if (isComponentSource(source) && !source.js) {
      return { name };
    }

    const cached = this.mem.get(name);
    if (cached && !this.isExpired(cached.compiledAt)) {
      return cached.entry;
    }

    const meta = await this.readMeta(name);
    if (meta && !this.isExpired(meta.compiledAt)) {
      const jsOk = await this.fileExists(path.join(this.pluginDir(name), 'index.js'));
      if (jsOk) {
        const cssOk = await this.fileExists(path.join(this.pluginDir(name), 'index.css'));
        const entry = this.toEntry(name, true, cssOk);
        this.mem.set(name, { compiledAt: meta.compiledAt, entry });
        return entry;
      }
    }

    const promise = this.build(name, source).finally(() => this.inflight.delete(name));
    this.inflight.set(name, promise);
    return promise;
  }

  private async build(name: string, source: PluginSource): Promise<PluginEntry | null> {
    const dir = this.pluginDir(name);
    await fs.mkdir(dir, { recursive: true });

    const jsPath = source.js;
    const cssPath = source.css;
    const action = isComponentSource(source)
      ? source.js
        ? detectAction(source.js)
        : undefined
      : (source.action ?? detectAction(source.js));

    if (!jsPath || !action) {
      return { name };
    }

    try {
      let hasCSS = false;

      if (action === 'compile') {
        ({ hasCSS } = await compilePlugin(jsPath, dir));
        if (!hasCSS && cssPath) {
          await copyPlugin(cssPath, dir, 'index.css');
          hasCSS = true;
        }
      } else {
        await copyPlugin(jsPath, dir, 'index.js');
        if (cssPath) {
          await copyPlugin(cssPath, dir, 'index.css');
          hasCSS = true;
        }
      }

      const compiledAt = Date.now();
      await this.writeMeta(name, { compiledAt });

      const entry = this.toEntry(name, true, hasCSS);
      this.mem.set(name, { compiledAt, entry });
      return entry;
    } catch (err) {
      console.error(`[SSR] Plugin "${name}" build failed:`, err);
      return null;
    }
  }

  async getEntries(names: string[]): Promise<PluginEntry[]> {
    if (names.length === 0) {
      return [];
    }

    const results = await Promise.all(names.map(n => this.prepare(n)));
    return results.filter((e): e is PluginEntry => e !== null && e.js !== undefined);
  }

  getComponents(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [name, source] of Object.entries(this.plugins)) {
      if (isComponentSource(source)) {
        out[name] = source.component;
      }
    }

    return out;
  }

  async invalidate(name?: string): Promise<void> {
    if (name) {
      this.mem.delete(name);
      await fs.rm(this.pluginDir(name), { recursive: true, force: true });
    } else {
      this.mem.clear();
      await fs.rm(this.outputDir, { recursive: true, force: true });
    }
  }

  destroy(): void {
    this.mem.clear();
  }

  private async readMeta(name: string): Promise<Meta | null> {
    try {
      const raw = await fs.readFile(path.join(this.pluginDir(name), META_FILE), 'utf-8');
      return JSON.parse(raw) as Meta;
    } catch {
      return null;
    }
  }

  private async writeMeta(name: string, meta: Meta): Promise<void> {
    await fs.writeFile(path.join(this.pluginDir(name), META_FILE), JSON.stringify(meta), 'utf-8');
  }

  private fileExists(p: string): Promise<boolean> {
    return fs
      .access(p)
      .then(() => true)
      .catch(() => false);
  }
}
