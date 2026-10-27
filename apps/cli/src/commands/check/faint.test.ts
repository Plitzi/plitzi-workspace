import { describe, expect, it } from 'vitest';

import { faintTexts } from './themes';

import type { TextGround } from './themes';

const page = 'rgb(255, 251, 242)';
const on = (text: string, color: string, ground: string, background: string): TextGround => ({
  text,
  color,
  ground,
  background,
  page
});

// encore-14: the later shows' time, rgb(99, 86, 69) on a readout's rgb(31, 27, 20) glass in light, "nothing wrong".
describe('words that barely read on their ground', () => {
  it('are said on a ground of one opaque colour, or the page’s — never on a gradient, a picture or a veil', () => {
    const issues = faintTexts([
      on('room-coming-time', 'rgb(99, 86, 69)', 'room-coming-plate', 'rgb(31, 27, 20) none'),
      on('room-coming-day', 'rgb(99, 86, 69)', 'room-coming-plate', 'rgb(31, 27, 20) none'),
      on('room-coming-title', 'rgb(243, 233, 214)', 'room-coming-plate', 'rgb(31, 27, 20) none'),
      on(
        'home-lede',
        'rgb(171, 158, 137)',
        'home-hero-night',
        'rgb(42, 32, 89) linear-gradient(rgb(255, 244, 230), rgb(255, 244, 230))'
      ),
      on('card-note', 'rgb(240, 240, 240)', 'card', 'rgba(0, 0, 0, 0.4) none'),
      on('footer-legend', 'rgb(235, 230, 220)', 'the page', '')
    ]);

    expect(issues.map(each => [each.code, each.elementId])).toEqual([
      ['faint-text', 'room-coming-time'],
      ['faint-text', 'footer-legend']
    ]);
    expect(issues[0]?.message).toMatch(/^room-coming-time, room-coming-day read at 2\.\d:1 on room-coming-plate/);
  });
});
