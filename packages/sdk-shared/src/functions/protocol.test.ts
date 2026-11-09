import { describe, expect, it } from 'vitest';

import { FUNCTIONS_PROTOCOL, protocolRefusal } from './protocol';

describe('which messages a runner takes, by the protocol they say they speak', () => {
  it('takes its own version, and an older minor of its major', () => {
    expect(protocolRefusal(FUNCTIONS_PROTOCOL)).toBeUndefined();
    expect(protocolRefusal('1.0', '1.3')).toBeUndefined();
  });

  // A newer minor can name what the runner never learnt: runners go out first, so it is the runner that is behind.
  it('refuses a newer minor, naming the runner as the side to upgrade', () => {
    expect(protocolRefusal('1.4', '1.3')).toBe(
      'This runner speaks protocol 1.3 and was sent 1.4, newer than it knows: upgrade the runner ' +
        '(the runner is deployed before the platform that calls it)'
    );
  });

  it('names the sides of another protocol as it is told them', () => {
    expect(protocolRefusal('2.0', '1.0', { here: 'worker', there: 'page server' })).toBe(
      'This worker speaks protocol 1.0 and was sent 2.0: another major. Upgrade the worker'
    );
  });

  it('refuses another major, naming whichever side is older', () => {
    expect(protocolRefusal('1.9', '2.0')).toContain('another major. Upgrade the platform');
    expect(protocolRefusal('3.0', '2.0')).toContain('another major. Upgrade the runner');
  });

  // The runner of before (an integer) is told apart from a message that is no version at all.
  it('refuses what is no version of it, saying what it was sent', () => {
    expect(protocolRefusal(1, '1.0')).toBe(
      'This runner speaks protocol 1.0, and was sent 1, which is no version of it'
    );
    expect(protocolRefusal(undefined, '1.0')).toContain('was sent undefined');
  });
});
