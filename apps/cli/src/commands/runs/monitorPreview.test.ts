import { describe, expect, it } from 'vitest';

import { outputTail, previewControl } from './monitorPreview';

import type { RunContext } from '../../runs/run';

describe('the preview from the monitor', () => {
  it('shows the last lines its server wrote, its colours and blank lines left out', () => {
    expect(outputTail('\x1b[32mready\x1b[0m in 312ms\n\nGET / 200\r\nGET /menu 200\n', 2)).toEqual([
      'GET / 200',
      'GET /menu 200'
    ]);
  });

  it('says a preview another process serves as served elsewhere, never one to stop from here', () => {
    const control = previewControl({} as RunContext, () => undefined);
    expect(control.state(8300)).toEqual({ kind: 'elsewhere', url: 'http://127.0.0.1:8300' });
    expect(control.state(undefined)).toEqual({ kind: 'none' });
    // Served elsewhere, `p` starts nothing.
    control.start('es-launch', 8300);
    expect(control.state(undefined)).toEqual({ kind: 'none' });
  });
});
