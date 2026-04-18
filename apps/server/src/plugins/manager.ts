import fs from 'node:fs/promises';
import path from 'node:path';

import { compilePlugin } from './compile';
import { copyPlugin } from './copy';
import { detectAction, isComponentSource } from './detect';

import type { PluginEntry, PluginSource } from '../types';

const META_FILE = 'meta.json';
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_CACHE_DIR = '.sdk-plugins';

type Meta = { compiledAt: number; version?: string };

type CacheEntry = { compiledAt: number; entry: PluginEntry };

export class PluginManager {
  readonly urlPrefix = '/sdk-plugins';
  readonly outputDir: string;

  private readonly plugins: Record<string, PluginSource>;
  private readonly ttlMs: number;
  private readonly mem = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<PluginEntry | null>>();
  private readonly failed = new Set<string>();
  /** Maps base plugin name → most recently registered effective key (may include @version) */
  private readonly nameIndex = new Map<string, string>();

  constructor(plugins: Record<string, PluginSource>, cacheDir?: string, ttlMs?: number) {
    this.plugins = plugins;
    this.outputDir = path.resolve(process.cwd(), cacheDir ?? DEFAULT_CACHE_DIR);
    this.ttlMs = ttlMs ?? DEFAULT_TTL_MS;
    for (const key of Object.keys(plugins)) {
      const baseName = key.replace(/@[^@]*$/, '');
      this.nameIndex.set(baseName, key);
    }
  }

  hasPlugin(name: string): boolean {
    return this.resolveKey(name) !== null;
  }

  register(name: string, source: PluginSource): void {
    this.plugins[name] = source;
    this.mem.delete(name);
    this.failed.delete(name);
    // Index by base name so callers can resolve without knowing the version
    const baseName = name.replace(/@[^@]*$/, '');
    this.nameIndex.set(baseName, name);
  }

  /**
   * Registers a plugin only if it is not yet known under its effective key.
   * Returns the effective key (`name@version` when version is set, `name` otherwise)
   * so the caller can pass it directly to getEntries().
   */
  ensure(name: string, source: PluginSource): string {
    const key = source.version ? `${name}@${source.version}` : name;
    if (!(key in this.plugins)) {
      this.register(key, source);
    }

    return key;
  }

  /**
   * Resolves a caller-supplied name to the effective key stored in the plugins map.
   * Accepts both the exact key (`plitziBuilder@1.0.0`) and the base name (`plitziBuilder`).
   */
  private resolveKey(name: string): string | null {
    if (name in this.plugins) return name;
    const indexed = this.nameIndex.get(name);
    if (indexed && indexed in this.plugins) return indexed;
    return null;
  }

  private pluginDir(name: string): string {
    return path.join(this.outputDir, name);
  }

  private isExpired(compiledAt: number): boolean {
    return Date.now() - compiledAt > this.ttlMs;
  }

  private toEntry(name: string, hasJS: boolean, cssUrl?: string): PluginEntry {
    const keyName = name.split('@')[0];
    const varName = keyName.split('-').join('_').split('.').join('_');
    return {
      name,
      varName,
      keyName,
      js: hasJS ? `${this.urlPrefix}/${name}/index.js` : undefined,
      css: cssUrl
    };
  }

  private isWebUrl(s: string): boolean {
    return s.startsWith('/') || s.startsWith('http://') || s.startsWith('https://');
  }

  async prepare(name: string): Promise<PluginEntry | null> {
    const key = this.resolveKey(name) ?? name;

    if (this.failed.has(key)) {
      return null;
    }

    const inflight = this.inflight.get(key);
    if (inflight !== undefined) {
      return inflight;
    }

    const source = this.plugins[key] as PluginSource | undefined;
    if (source === undefined) {
      return null;
    }

    if (isComponentSource(source) && !source.js) {
      return this.toEntry(key, false);
    }

    const cached = this.mem.get(key);
    if (cached && !this.isExpired(cached.compiledAt)) {
      const jsOk = await this.fileExists(path.join(this.pluginDir(key), 'index.js'));
      if (jsOk) {
        return cached.entry;
      }
      // File was deleted from disk — drop memory cache and rebuild
      console.warn(`[SSR] Plugin "${key}" cache invalidated: output file missing, rebuilding…`);
      this.mem.delete(key);
    }

    const meta = await this.readMeta(key);
    if (meta) {
      const sourceVersion = source.version;

      if (sourceVersion && meta.version !== sourceVersion) {
        // Version changed — nuke disk cache so build() starts clean
        console.log(`[SSR] Plugin "${key}" version changed (${meta.version ?? 'none'} → ${sourceVersion}), rebuilding…`);
        await fs.rm(this.pluginDir(key), { recursive: true, force: true });
      } else if (sourceVersion || !this.isExpired(meta.compiledAt)) {
        // Versioned plugins never expire; unversioned respect TTL
        const jsOk = await this.fileExists(path.join(this.pluginDir(key), 'index.js'));
        if (jsOk) {
          const sourceCss = source.css;
          let cssUrl: string | undefined;
          if (await this.fileExists(path.join(this.pluginDir(key), 'index.css'))) {
            cssUrl = `${this.urlPrefix}/${key}/index.css`;
          } else if (sourceCss && this.isWebUrl(sourceCss)) {
            cssUrl = sourceCss;
          }

          const entry = this.toEntry(key, true, cssUrl);
          this.mem.set(key, { compiledAt: meta.compiledAt, entry });
          return entry;
        }
      }
    }

    const promise = this.build(key, source).finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
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
      return this.toEntry(name, false);
    }

    console.log(`[SSR] Plugin "${name}" building (${action}: ${jsPath})…`);

    try {
      let cssUrl: string | undefined;

      if (action === 'compile') {
        const { hasCSS } = await compilePlugin(jsPath, dir);
        if (hasCSS) {
          cssUrl = `${this.urlPrefix}/${name}/index.css`;
        } else if (cssPath) {
          if (this.isWebUrl(cssPath)) {
            cssUrl = cssPath;
          } else {
            await copyPlugin(cssPath, dir, 'index.css');
            cssUrl = `${this.urlPrefix}/${name}/index.css`;
          }
        }
      } else if (action === 'download') {
        const jsRes = await fetch(jsPath);
        if (!jsRes.ok) throw new Error(`HTTP ${jsRes.status} downloading ${jsPath}`);
        await fs.writeFile(path.join(dir, 'index.js'), await jsRes.text());

        if (cssPath) {
          const isRemote = cssPath.startsWith('http://') || cssPath.startsWith('https://');
          if (isRemote) {
            const cssRes = await fetch(cssPath);
            if (!cssRes.ok) throw new Error(`HTTP ${cssRes.status} downloading ${cssPath}`);
            await fs.writeFile(path.join(dir, 'index.css'), await cssRes.text());
          } else if (this.isWebUrl(cssPath)) {
            cssUrl = cssPath; // absolute local path — serve as-is
          } else {
            await copyPlugin(cssPath, dir, 'index.css');
          }

          cssUrl = `${this.urlPrefix}/${name}/index.css`;
        }
      } else {
        await copyPlugin(jsPath, dir, 'index.js');
        if (cssPath) {
          if (this.isWebUrl(cssPath)) {
            cssUrl = cssPath;
          } else {
            await copyPlugin(cssPath, dir, 'index.css');
            cssUrl = `${this.urlPrefix}/${name}/index.css`;
          }
        }
      }

      const compiledAt = Date.now();
      await this.writeMeta(name, { compiledAt, version: source.version });

      const entry = this.toEntry(name, true, cssUrl);
      this.mem.set(name, { compiledAt, entry });
      console.log(`[SSR] Plugin "${name}" ready → ${entry.js}`);
      return entry;
    } catch (err) {
      console.error(`[SSR] Plugin "${name}" build failed (js: ${source.js ?? 'none'}):`, err);
      this.failed.add(name);
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
        // Use base name (without @version) so the SDK can find the component by renderType
        out[name.replace(/@[^@]*$/, '')] = source.component;
      }
    }

    return out;
  }

  async invalidate(name?: string, version?: string): Promise<void> {
    if (!name) {
      this.mem.clear();
      this.failed.clear();
      this.nameIndex.clear();
      await fs.rm(this.outputDir, { recursive: true, force: true });
      return;
    }

    if (version) {
      // Invalidate one specific version
      const key = `${name}@${version}`;
      this.mem.delete(key);
      this.failed.delete(key);
      if (this.nameIndex.get(name) === key) this.nameIndex.delete(name);
      await fs.rm(this.pluginDir(key), { recursive: true, force: true });
      return;
    }

    // Invalidate all versions: exact name + every name@* variant
    const prefix = `${name}@`;
    const keysToEvict = new Set<string>();
    keysToEvict.add(name);
    for (const key of Object.keys(this.plugins)) {
      if (key.startsWith(prefix)) keysToEvict.add(key);
    }
    for (const key of this.mem.keys()) {
      if (key.startsWith(prefix)) keysToEvict.add(key);
    }

    for (const key of keysToEvict) {
      this.mem.delete(key);
      this.failed.delete(key);
    }
    this.nameIndex.delete(name);

    // Remove matching dirs from disk
    try {
      const entries = await fs.readdir(this.outputDir);
      await Promise.all(
        entries
          .filter(e => e === name || e.startsWith(prefix))
          .map(e => fs.rm(path.join(this.outputDir, e), { recursive: true, force: true }))
      );
    } catch {
      // outputDir doesn't exist yet — nothing to clean
    }
  }

  destroy(): void {
    this.mem.clear();
    this.failed.clear();
    this.nameIndex.clear();
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
