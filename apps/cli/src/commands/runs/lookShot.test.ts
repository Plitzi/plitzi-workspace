import { describe, expect, it } from 'vitest';

import { lookShotArgs } from './lookShot';

// A stalled player was pictured at rest beside the run before, the look's check reading it stalled: the pictures set
// beside the run before left out the look's steps.
describe('a look’s picture', () => {
  it('plays the look’s steps first — beside the run before too', () => {
    const at = {
      route: '/r/night-drive',
      url: 'http://127.0.0.1:9000',
      reader: ['--block', 'iframe_api'],
      clip: [],
      steps: 'wait-for room-player 40s',
      width: '1440',
      scheme: 'light',
      out: '/tmp/a.png'
    };

    for (const args of [lookShotArgs(at), lookShotArgs({ ...at, compare: 'http://127.0.0.1:9001' })]) {
      expect(args.slice(args.indexOf('--steps'), args.indexOf('--steps') + 2)).toEqual([
        '--steps',
        'wait-for room-player 40s'
      ]);
      expect(args).toContain('--block');
    }

    expect(lookShotArgs({ ...at, steps: undefined })).not.toContain('--steps');
  });
});
