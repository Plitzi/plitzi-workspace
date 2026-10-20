import { describe, test, expect } from 'vitest';

import { calculateDistances } from './BuilderOverlayHelper';

describe('Testing BuilderOverlayHelper', () => {
  test('calculateDistances center to random directions not overlaped', () => {
    const selected = {
      top: 199,
      bottom: 431,
      left: 604,
      right: 836,
      centerX: 720,
      centerY: 315,
      width: 232,
      height: 232
    };

    // Scenario 1
    let hovered = {
      top: 25,
      bottom: 69,
      left: 0,
      right: 149.90625,
      centerX: 74.953125,
      centerY: 47,
      width: 149.90625,
      height: 44
    };
    let distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'top',
          position: { height: 130, left: 720, top: 69, width: 2 },
          value: 130
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'left',
          position: { height: 2, left: 149.90625, top: 315, width: 454.09375 },
          value: 454.09
        }
      ],
      projections: [
        { position: { height: 2, left: 149.90625, top: 69, width: 570.09375 }, placement: 'top' },
        { position: { height: 246, left: 149.91000000000003, top: 69, width: 2 }, placement: 'left' }
      ]
    });

    // Scenario 2
    hovered = {
      top: 25,
      bottom: 69,
      left: 1290.09375,
      right: 1440,
      centerX: 1365.046875,
      centerY: 47,
      width: 149.90625,
      height: 44
    };
    distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'top',
          position: { height: 130, left: 720, top: 69, width: 2 },
          value: 130
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'right',
          position: { height: 2, left: 836, top: 315, width: 454.09375 },
          value: 454.09
        }
      ],
      projections: [
        { position: { height: 2, left: 720, top: 69, width: 570.09375 }, placement: 'top' },
        { position: { height: 246, left: 1290.09, top: 69, width: 2 }, placement: 'right' }
      ]
    });

    // Scenario 3
    hovered = {
      top: 561,
      bottom: 605,
      left: 0,
      right: 149.90625,
      centerX: 74.953125,
      centerY: 583,
      width: 149.90625,
      height: 44
    };
    distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'bottom',
          position: { height: 130, left: 720, top: 431, width: 2 },
          value: 130
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'left',
          position: { height: 2, left: 149.90625, top: 315, width: 454.09375 },
          value: 454.09
        }
      ],
      projections: [
        { position: { height: 2, left: 149.90625, top: 561, width: 570.09375 }, placement: 'bottom' },
        { position: { height: 246, left: 149.91000000000003, top: 315, width: 2 }, placement: 'left' }
      ]
    });

    // Scenario 4
    hovered = {
      top: 561,
      bottom: 605,
      left: 1290.09375,
      right: 1440,
      centerX: 1365.046875,
      centerY: 583,
      width: 149.90625,
      height: 44
    };
    distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'bottom',
          position: { height: 130, left: 720, top: 431, width: 2 },
          value: 130
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'right',
          position: { height: 2, left: 836, top: 315, width: 454.09375 },
          value: 454.09
        }
      ],
      projections: [
        { position: { height: 2, left: 720, top: 561, width: 570.09375 }, placement: 'bottom' },
        { position: { height: 246, left: 1290.09, top: 315, width: 2 }, placement: 'right' }
      ]
    });

    // Scenario 5 (selected and hovered are top-centered, hovered is smaller than selected)
    hovered = {
      top: 110.5,
      bottom: 154.5,
      left: 645,
      right: 795,
      centerX: 720,
      centerY: 132.5,
      width: 150,
      height: 44
    };
    distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: true,
          isOverlaped: false,
          placement: 'top',
          position: { height: 44.5, left: 720, top: 154.5, width: 2 },
          value: 44.5
        },
        {
          isCentered: false,
          isOverlaped: true,
          placement: 'left',
          position: { height: 2, left: 604, top: 132.5, width: 41 },
          value: 41
        },
        {
          isCentered: false,
          isOverlaped: true,
          placement: 'right',
          position: { height: 2, left: 795, top: 132.5, width: 41 },
          value: 41
        }
      ],
      projections: [
        { position: { height: 66.5, left: 604, top: 132.5, width: 2 }, placement: 'left' },
        { position: { height: 66.5, left: 836, top: 132.5, width: 2 }, placement: 'right' }
      ]
    });

    // Scenario 6 (selected and hovered are bottom-centered, hovered is smaller than selected)
    hovered = {
      top: 500.5,
      bottom: 544.5,
      left: 645,
      right: 795,
      centerX: 720,
      centerY: 522.5,
      width: 150,
      height: 44
    };
    distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: true,
          isOverlaped: false,
          placement: 'bottom',
          position: { height: 69.5, left: 720, top: 431, width: 2 },
          value: 69.5
        },
        {
          isCentered: false,
          isOverlaped: true,
          placement: 'left',
          position: { height: 2, left: 604, top: 522.5, width: 41 },
          value: 41
        },
        {
          isCentered: false,
          isOverlaped: true,
          placement: 'right',
          position: { height: 2, left: 795, top: 522.5, width: 41 },
          value: 41
        }
      ],
      projections: [
        { position: { height: 91.5, left: 604, top: 431, width: 2 }, placement: 'left' },
        { position: { height: 91.5, left: 836, top: 431, width: 2 }, placement: 'right' }
      ]
    });
  });
  test('calculateDistances selected to hover inside centered', () => {
    const selected = {
      top: 237.5,
      bottom: 337.5,
      left: 670,
      right: 770,
      centerX: 720,
      centerY: 287.5,
      width: 100,
      height: 100
    };

    const hovered = {
      top: 171.5,
      bottom: 403.5,
      left: 604,
      right: 836,
      centerX: 720,
      centerY: 287.5,
      width: 232,
      height: 232
    };

    const distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: true,
          isOverlaped: false,
          placement: 'top',
          position: { height: 66, left: 720, top: 171.5, width: 2 },
          value: 66
        },
        {
          isCentered: true,
          isOverlaped: false,
          placement: 'bottom',
          position: { height: 66, left: 720, top: 337.5, width: 2 },
          value: 66
        },
        {
          isCentered: true,
          isOverlaped: false,
          placement: 'left',
          position: { height: 2, left: 604, top: 287.5, width: 66 },
          value: 66
        },
        {
          isCentered: true,
          isOverlaped: false,
          placement: 'right',
          position: { height: 2, left: 770, top: 287.5, width: 66 },
          value: 66
        }
      ],
      projections: []
    });
  });
});
