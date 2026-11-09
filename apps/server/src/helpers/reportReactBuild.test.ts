import { describe, expect, it, vi } from 'vitest';

import { configureServerLog } from '@plitzi/sdk-kernel/log';

import { reportReactBuild } from './reportReactBuild';

import type { ServerLogger } from '@plitzi/sdk-kernel/types';

describe('reportReactBuild', () => {
  it('says once that a production server renders with the development build, and never while developing', () => {
    const sink = vi.fn<ServerLogger>();
    configureServerLog({ level: 'error', logger: sink });

    reportReactBuild(true, undefined);
    reportReactBuild(false, 'production');
    expect(sink).not.toHaveBeenCalled();

    reportReactBuild(false, undefined);
    reportReactBuild(false, 'development');

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0]).toMatchObject({ kind: 'message', level: 'error' });
  });
});
