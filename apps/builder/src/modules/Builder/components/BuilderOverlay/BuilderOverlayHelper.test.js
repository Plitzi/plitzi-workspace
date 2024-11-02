// Packages
import { expect, describe, test } from '@jest/globals';

// Relatives
import { calculateDistances } from './BuilderOverlayHelper';

describe('Testing BuilderOverlayHelper', () => {
  test('calculateDistances center to all directions not overlaped', () => {
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

    // center to top-left
    let hovered = {
      top: 171.5,
      bottom: 221.5,
      left: 604,
      right: 654,
      centerX: 629,
      centerY: 196.5,
      width: 50,
      height: 50
    };
    let distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: false,
          placement: 'top',
          position: { height: 16, left: 720, top: 221.5, width: 2 },
          value: 16
        },
        {
          isCentered: false,
          placement: 'left',
          position: { height: 2, left: 654, top: 287.5, width: 16 },
          value: 16
        }
      ],
      projections: [
        { position: { height: 2, left: 654, top: 219.5, width: 66 } },
        { position: { height: 66, left: 654, top: 221.5, width: 2 } }
      ]
    });

    // center to top-center
    hovered = {
      top: 171.5,
      bottom: 221.5,
      left: 670,
      right: 770,
      centerX: 720,
      centerY: 196.5,
      width: 100,
      height: 50
    };
    distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: true,
          placement: 'top',
          position: { height: 16, left: 720, top: 221.5, width: 2 },
          value: 16
        }
      ],
      projections: []
    });

    // center to top-right
    hovered = {
      top: 171.5,
      bottom: 221.5,
      left: 786,
      right: 836,
      centerX: 811,
      centerY: 196.5,
      width: 50,
      height: 50
    };
    distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: false,
          placement: 'top',
          position: { height: 16, left: 720, top: 221.5, width: 2 },
          value: 16
        },
        {
          isCentered: false,
          placement: 'right',
          position: { height: 2, left: 770, top: 287.5, width: 16 },
          value: 16
        }
      ],
      projections: [
        { position: { height: 2, left: 720, top: 219.5, width: 66 } },
        { position: { height: 66, left: 786, top: 221.5, width: 2 } }
      ]
    });

    // center to right-center
    hovered = {
      top: 237.5,
      bottom: 337.5,
      left: 786,
      right: 836,
      centerX: 811,
      centerY: 287.5,
      width: 50,
      height: 100
    };
    distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: true,
          placement: 'right',
          position: { height: 2, left: 770, top: 287.5, width: 16 },
          value: 16
        }
      ],
      projections: []
    });

    // center to bottom-right
    hovered = {
      top: 353.5,
      bottom: 403.5,
      left: 786,
      right: 836,
      centerX: 811,
      centerY: 378.5,
      width: 50,
      height: 50
    };
    distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: false,
          placement: 'bottom',
          position: { height: 16, left: 720, top: 337.5, width: 2 },
          value: 16
        },
        {
          isCentered: false,
          placement: 'right',
          position: { height: 2, left: 770, top: 287.5, width: 16 },
          value: 16
        }
      ],
      projections: [
        { position: { height: 2, left: 720, top: 353.5, width: 66 } },
        { position: { height: 66, left: 786, top: 287.5, width: 2 } }
      ]
    });

    // center to bottom-center
    hovered = {
      top: 353.5,
      bottom: 403.5,
      left: 670,
      right: 770,
      centerX: 720,
      centerY: 378.5,
      width: 100,
      height: 50
    };
    distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: true,
          placement: 'bottom',
          position: { height: 16, left: 720, top: 337.5, width: 2 },
          value: 16
        }
      ],
      projections: []
    });

    // center to bottom-left
    hovered = {
      top: 353.5,
      bottom: 403.5,
      left: 604,
      right: 654,
      centerX: 629,
      centerY: 378.5,
      width: 50,
      height: 50
    };
    distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: false,
          placement: 'bottom',
          position: { height: 16, left: 720, top: 337.5, width: 2 },
          value: 16
        },
        {
          isCentered: false,
          placement: 'left',
          position: { height: 2, left: 654, top: 287.5, width: 16 },
          value: 16
        }
      ],
      projections: [
        { position: { height: 2, left: 654, top: 353.5, width: 66 } },
        { position: { height: 66, left: 654, top: 287.5, width: 2 } }
      ]
    });

    // center to left-center
    hovered = {
      top: 237.5,
      bottom: 337.5,
      left: 604,
      right: 654,
      centerX: 629,
      centerY: 287.5,
      width: 50,
      height: 100
    };
    distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: true,
          placement: 'left',
          position: { height: 2, left: 654, top: 287.5, width: 16 },
          value: 16
        }
      ],
      projections: []
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
          placement: 'top',
          position: { height: 66, left: 720, top: 171.5, width: 2 },
          value: 66
        },
        {
          isCentered: true,
          placement: 'bottom',
          position: { height: 66, left: 720, top: 337.5, width: 2 },
          value: 66
        },
        {
          isCentered: true,
          placement: 'left',
          position: { height: 2, left: 604, top: 287.5, width: 66 },
          value: 66
        },
        {
          isCentered: true,
          placement: 'right',
          position: { height: 2, left: 770, top: 287.5, width: 66 },
          value: 66
        }
      ],
      projections: []
    });
  });

  test('calculateDistances selected to hover inside random positions', () => {
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

    // Scenario 1
    let hovered = {
      top: 171.5,
      bottom: 221.5,
      left: 604,
      right: 654,
      centerX: 629,
      centerY: 196.5,
      width: 50,
      height: 50
    };

    let distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: true,
          placement: 'top',
          position: { height: 66, left: 720, top: 171.5, width: 2 },
          value: 66
        },
        {
          isCentered: true,
          placement: 'bottom',
          position: { height: 66, left: 720, top: 337.5, width: 2 },
          value: 66
        },
        {
          isCentered: true,
          placement: 'left',
          position: { height: 2, left: 604, top: 287.5, width: 66 },
          value: 66
        },
        {
          isCentered: true,
          placement: 'right',
          position: { height: 2, left: 770, top: 287.5, width: 66 },
          value: 66
        }
      ],
      projections: []
    });
  });
});
