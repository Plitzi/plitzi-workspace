export class RequestMetrics {
  private readonly start: number;
  private readonly phases: Array<{ name: string; dur: number }> = [];

  constructor() {
    this.start = performance.now();
  }

  async measure<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
    const t = performance.now();
    const result = await Promise.resolve(fn());
    this.phases.push({ name, dur: Math.round(performance.now() - t) });

    return result;
  }

  /** Formats as Server-Timing header value. */
  toServerTimingHeader(): string {
    const total = Math.round(performance.now() - this.start);

    return [...this.phases.map(p => `${p.name};dur=${p.dur}`), `total;dur=${total}`].join(', ');
  }

  record(name: string, dur: number): void {
    this.phases.push({ name, dur });
  }

  /** Logs a one-line summary to stdout (dev mode only). */
  log(label: string): void {
    const total = Math.round(performance.now() - this.start);
    const parts = this.phases.map(p => `${p.name}=${p.dur}ms`).join(' ');
    console.log(`[SSR] ${label} — ${parts} | total=${total}ms`);
  }
}
