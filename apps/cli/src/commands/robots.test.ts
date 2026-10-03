import { describe, expect, it } from 'vitest';

import { robotsAllows } from './robots';

describe('robotsAllows', () => {
  const robots = [
    'User-agent: *',
    'Disallow: /private',
    'Allow: /private/press',
    'Disallow: /*.pdf$',
    '',
    'User-agent: Googlebot',
    'User-agent: plitzi',
    'Disallow: /drafts # not ready',
    '',
    'User-agent: other',
    'Disallow:'
  ].join('\n');

  it('allows what no rule names, and a site without rules', () => {
    expect(robotsAllows(robots, '/products', 'Mozilla/5.0 something')).toBe(true);
    expect(robotsAllows('', '/anything', 'plitzi')).toBe(true);
  });

  it('follows the group for every agent when none names this one', () => {
    expect(robotsAllows(robots, '/private/team', 'some-agent')).toBe(false);
    expect(robotsAllows(robots, '/files/report.pdf', 'some-agent')).toBe(false);
    expect(robotsAllows(robots, '/files/report.pdf?x=1', 'some-agent')).toBe(true);
  });

  it('lets the longest rule win', () => {
    expect(robotsAllows(robots, '/private/press/kit', 'some-agent')).toBe(true);
  });

  it('follows only the group that names the agent, shared by consecutive lines', () => {
    expect(robotsAllows(robots, '/drafts/one', 'Plitzi-Import/1.0')).toBe(false);
    expect(robotsAllows(robots, '/private/team', 'Plitzi-Import/1.0')).toBe(true);
  });

  it('reads an empty Disallow as allowing everything', () => {
    expect(robotsAllows('User-agent: *\nDisallow:', '/private', 'x')).toBe(true);
    expect(robotsAllows('User-agent: *\nDisallow: /', '/private', 'x')).toBe(false);
  });
});
