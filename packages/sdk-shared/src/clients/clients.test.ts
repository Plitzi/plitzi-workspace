import { describe, expect, it } from 'vitest';

import { behindText, clientHeaderValue, clientOf, judgeClient, oldestByDefault, outdatedText } from './index';

const platform = { current: '0.40.2', oldest: { cli: '0.39.0', builder: '0.40.0' } };

describe('a client judged against the platform', () => {
  it('reads the client a request names, and nothing from what names none', () => {
    expect(clientOf(clientHeaderValue('cli', '0.39.3'))).toEqual({ surface: 'cli', version: '0.39.3' });
    expect(clientOf(undefined)).toBeUndefined();
    expect(clientOf('Mozilla/5.0')).toBeUndefined();
    expect(clientOf('cli/latest')).toBeUndefined();
  });

  it('answers a request that names no client as any other', () => {
    expect(judgeClient(undefined, platform)).toEqual({ kind: 'current' });
  });

  it('takes a client as new as the platform, and one a patch behind', () => {
    expect(judgeClient('cli/0.40.2', platform)).toEqual({ kind: 'current' });
    expect(judgeClient('cli/0.40.0', platform)).toEqual({ kind: 'current' });
    expect(judgeClient('cli/0.41.0', platform)).toEqual({ kind: 'current' });
  });

  it('takes a client a minor behind, and tells it what is current', () => {
    const verdict = judgeClient('cli/0.39.3', platform);

    expect(verdict).toEqual({ kind: 'behind', surface: 'cli', version: '0.39.3', current: '0.40.2' });
    expect(behindText('cli', '0.39.3', '0.40.2')).toContain('plitzi upgrade packages');
  });

  it('refuses one older than the platform takes, with the step that upgrades it — each surface its own floor', () => {
    const verdict = judgeClient('cli/0.38.9', platform);

    expect(verdict).toEqual({
      kind: 'refused',
      surface: 'cli',
      version: '0.38.9',
      oldest: '0.39.0',
      current: '0.40.2'
    });
    expect(verdict.kind === 'refused' && outdatedText(verdict)).toBe(
      'This CLI is 0.38.9, and the platform (0.40.2) takes 0.39.0 and later: in a project, plitzi upgrade packages (the CLI is one of them); elsewhere, npx @plitzi/cli@latest.'
    );
    expect(judgeClient('builder/0.39.3', platform).kind).toBe('refused');
  });

  it('takes the minor before its own by default', () => {
    expect(oldestByDefault('0.40.2')).toBe('0.39.0');
    expect(oldestByDefault('1.0.4')).toBe('1.0.0');
  });
});
