import { describe, expect, it } from 'vitest';

import { fixedGrounds } from './themes';

import type { TextGround } from './themes';

const CREAM_PAGE = 'rgb(245, 237, 220)';
const NIGHT_PAGE = 'rgb(10, 16, 36)';

const reading = (text: string, color: string, background: string, page: string, ground = 'match-judge-winner') => ({
  text,
  color,
  ground,
  background,
  page
});

// velada-fidelity: the judges' rows a fixed dark colour under the theme's text — grey bars, a gold count lost on them.
describe('a ground that does not follow the theme', () => {
  it('is found when it is the same in both schemes under a text that changes and barely reads in one', () => {
    const fixed = 'rgba(10, 16, 36, 0.55) none';
    const issues = fixedGrounds(
      [reading('match-judge-winner-votes', 'rgb(122, 90, 30)', fixed, CREAM_PAGE)],
      [reading('match-judge-winner-votes', 'rgb(199, 168, 107)', fixed, NIGHT_PAGE)]
    );

    expect(issues).toEqual([
      expect.objectContaining({
        code: 'fixed-ground',
        elementId: 'match-judge-winner',
        message: expect.stringMatching(/match-judge-winner-votes: .* and in light it reads at 1\.\d:1/) as unknown
      })
    ]);
  });

  it('is not one when the text reads on it in both, the ground follows the theme, or it is a picture', () => {
    const card = 'rgba(0, 0, 0, 0) linear-gradient(rgb(12, 19, 48) 0%, rgb(6, 10, 29) 100%)';
    const none: TextGround[][] = [
      // Cream, then gold, on a dark card: it changes, and reads on both.
      [
        reading('fight-card-corner-name', 'rgb(244, 228, 201)', card, CREAM_PAGE, 'fight-card'),
        reading('fight-card-corner-name', 'rgb(216, 191, 143)', card, NIGHT_PAGE, 'fight-card')
      ],
      [
        reading('row-name', 'rgb(10, 16, 36)', 'rgba(10, 16, 36, 0.05) none', CREAM_PAGE),
        reading('row-name', 'rgb(244, 228, 201)', 'rgba(10, 16, 36, 0.55) none', NIGHT_PAGE)
      ],
      [
        reading('hero-title', 'rgb(10, 16, 36)', 'rgba(0, 0, 0, 0) url("hero.webp")', CREAM_PAGE, 'home-hero'),
        reading('hero-title', 'rgb(244, 228, 201)', 'rgba(0, 0, 0, 0) url("hero.webp")', NIGHT_PAGE, 'home-hero')
      ]
    ];

    for (const [light, dark] of none) {
      expect(fixedGrounds([light], [dark])).toEqual([]);
    }
  });
});
