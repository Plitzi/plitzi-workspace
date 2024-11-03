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
          isOverlaped: false,
          placement: 'top',
          position: { height: 16, left: 720, top: 221.5, width: 2 },
          value: 16
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'left',
          position: { height: 2, left: 654, top: 287.5, width: 16 },
          value: 16
        }
      ],
      projections: [
        { position: { height: 2, left: 654, top: 219.5, width: 66 }, placement: 'top' },
        { position: { height: 66, left: 654, top: 221.5, width: 2 }, placement: 'left' }
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
          isOverlaped: false,
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
          isOverlaped: false,
          placement: 'top',
          position: { height: 16, left: 720, top: 221.5, width: 2 },
          value: 16
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'right',
          position: { height: 2, left: 770, top: 287.5, width: 16 },
          value: 16
        }
      ],
      projections: [
        { position: { height: 2, left: 720, top: 219.5, width: 66 }, placement: 'top' },
        { position: { height: 66, left: 786, top: 221.5, width: 2 }, placement: 'right' }
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
          isOverlaped: false,
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
          isOverlaped: false,
          placement: 'bottom',
          position: { height: 16, left: 720, top: 337.5, width: 2 },
          value: 16
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'right',
          position: { height: 2, left: 770, top: 287.5, width: 16 },
          value: 16
        }
      ],
      projections: [
        { position: { height: 2, left: 720, top: 353.5, width: 66 }, placement: 'bottom' },
        { position: { height: 66, left: 786, top: 287.5, width: 2 }, placement: 'right' }
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
          isOverlaped: false,
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
          isOverlaped: false,
          placement: 'bottom',
          position: { height: 16, left: 720, top: 337.5, width: 2 },
          value: 16
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'left',
          position: { height: 2, left: 654, top: 287.5, width: 16 },
          value: 16
        }
      ],
      projections: [
        { position: { height: 2, left: 654, top: 353.5, width: 66 }, placement: 'bottom' },
        { position: { height: 66, left: 654, top: 287.5, width: 2 }, placement: 'left' }
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
          isOverlaped: false,
          placement: 'left',
          position: { height: 2, left: 654, top: 287.5, width: 16 },
          value: 16
        }
      ],
      projections: []
    });
  });

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
        { position: { height: 2, left: 149.90625, top: 67, width: 570.09375 }, placement: 'top' },
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
        { position: { height: 2, left: 720, top: 67, width: 570.09375 }, placement: 'top' },
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
        { position: { height: 66.5, left: 834, top: 132.5, width: 2 }, placement: 'right' }
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
        { position: { height: 91.5, left: 834, top: 431, width: 2 }, placement: 'right' }
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

  test('calculateDistances selected to all directions inside no overlaped', () => {
    const selected = {
      top: 171.5,
      bottom: 403.5,
      left: 604,
      right: 836,
      centerX: 720,
      centerY: 287.5,
      width: 232,
      height: 232
    };

    // inside to top-left
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
          isOverlaped: false,
          placement: 'bottom',
          position: { height: 182, left: 629, top: 221.5, width: 2 },
          value: 182
        },
        {
          isCentered: false,
          placement: 'right',
          isOverlaped: false,
          position: { height: 2, left: 654, top: 196.5, width: 182 },
          value: 182
        }
      ],
      projections: []
    });

    // inside to top-center
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
          isOverlaped: false,
          placement: 'bottom',
          position: { height: 182, left: 720, top: 221.5, width: 2 },
          value: 182
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'left',
          position: { height: 2, left: 604, top: 196.5, width: 66 },
          value: 66
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'right',
          position: { height: 2, left: 770, top: 196.5, width: 66 },
          value: 66
        }
      ],
      projections: []
    });

    // inside to top-right
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
          isOverlaped: false,
          placement: 'bottom',
          position: { height: 182, left: 811, top: 221.5, width: 2 },
          value: 182
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'left',
          position: { height: 2, left: 604, top: 196.5, width: 182 },
          value: 182
        }
      ],
      projections: []
    });

    // inside to right-center
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
          isCentered: false,
          isOverlaped: false,
          placement: 'top',
          position: { height: 66, left: 811, top: 171.5, width: 2 },
          value: 66
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'bottom',
          position: { height: 66, left: 811, top: 337.5, width: 2 },
          value: 66
        },
        {
          isCentered: true,
          isOverlaped: false,
          placement: 'left',
          position: { height: 2, left: 604, top: 287.5, width: 182 },
          value: 182
        }
      ],
      projections: []
    });

    // inside to right-bottom
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
          isOverlaped: false,
          placement: 'top',
          position: { height: 182, left: 811, top: 171.5, width: 2 },
          value: 182
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'left',
          position: { height: 2, left: 604, top: 378.5, width: 182 },
          value: 182
        }
      ],
      projections: []
    });

    // inside to bottom-center
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
          isOverlaped: false,
          placement: 'top',
          position: { height: 182, left: 720, top: 171.5, width: 2 },
          value: 182
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'left',
          position: { height: 2, left: 604, top: 378.5, width: 66 },
          value: 66
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'right',
          position: { height: 2, left: 770, top: 378.5, width: 66 },
          value: 66
        }
      ],
      projections: []
    });

    // inside to bottom-left
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
          isOverlaped: false,
          placement: 'top',
          position: { height: 182, left: 629, top: 171.5, width: 2 },
          value: 182
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'right',
          position: { height: 2, left: 654, top: 378.5, width: 182 },
          value: 182
        }
      ],
      projections: []
    });

    // inside to left-center
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
          isCentered: false,
          isOverlaped: false,
          placement: 'top',
          position: { height: 66, left: 629, top: 171.5, width: 2 },
          value: 66
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'bottom',
          position: { height: 66, left: 629, top: 337.5, width: 2 },
          value: 66
        },
        {
          isCentered: true,
          isOverlaped: false,
          placement: 'right',
          position: { height: 2, left: 654, top: 287.5, width: 182 },
          value: 182
        }
      ],
      projections: []
    });
  });

  test('calculateDistances selected to hover overlaped', () => {
    const selected = {
      top: 199,
      bottom: 431,
      left: 482.5,
      right: 714.5,
      centerX: 598.5,
      centerY: 315,
      width: 232,
      height: 232
    };

    // Scenario 1
    let hovered = {
      top: 151,
      bottom: 383,
      left: 1047.09375,
      right: 1197,
      centerX: 1122.046875,
      centerY: 267,
      width: 149.90625,
      height: 232
    };
    let distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: false,
          isOverlaped: true,
          placement: 'top',
          position: { height: 48, left: 598.5, top: 151, width: 2 },
          value: 48
        },
        {
          isCentered: false,
          isOverlaped: true,
          placement: 'bottom',
          position: { height: 48, left: 1122.046875, top: 383, width: 2 },
          value: 48
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'right',
          position: { height: 2, left: 714.5, top: 315, width: 332.59375 },
          value: 332.59
        }
      ],
      projections: [
        { position: { height: 2, left: 598.5, top: 149, width: 448.59375 }, placement: 'top' },
        { position: { height: 2, left: 714.5, top: 429, width: 407.546875 }, placement: 'bottom' }
      ]
    });

    // Scenario 2
    hovered = {
      top: 187,
      bottom: 231,
      left: 807.703125,
      right: 957.609375,
      centerX: 882.65625,
      centerY: 209,
      width: 149.90625,
      height: 44
    };
    distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: false,
          isOverlaped: true,
          placement: 'top',
          position: { height: 12, left: 598.5, top: 187, width: 2 },
          value: 12
        },
        {
          isCentered: false,
          isOverlaped: true,
          placement: 'bottom',
          position: { height: 200, left: 882.65625, top: 231, width: 2 },
          value: 200
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'right',
          position: { height: 2, left: 714.5, top: 229, width: 93.203125 },
          value: 93.2
        }
      ],
      projections: [
        { placement: 'top', position: { height: 2, left: 598.5, top: 185, width: 209.203125 } },
        { placement: 'bottom', position: { height: 2, left: 714.5, top: 429, width: 168.15625 } }
      ]
    });

    // Scenario3
    hovered = {
      top: 284.1875,
      bottom: 328.1875,
      left: 807.703125,
      right: 957.609375,
      centerX: 882.65625,
      centerY: 306.1875,
      width: 149.90625,
      height: 44
    };
    distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: false,
          isOverlaped: true,
          placement: 'top',
          position: { height: 85.1875, left: 882.65625, top: 199, width: 2 },
          value: 85.19
        },
        {
          isCentered: false,
          isOverlaped: true,
          placement: 'bottom',
          position: { height: 102.8125, left: 882.65625, top: 328.1875, width: 2 },
          value: 102.81
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'right',
          position: { height: 2, left: 714.5, top: 315, width: 93.203125 },
          value: 93.2
        }
      ],
      projections: [
        { placement: 'top', position: { height: 2, left: 714.5, top: 199, width: 168.15625 } },
        { placement: 'bottom', position: { height: 2, left: 714.5, top: 429, width: 168.15625 } }
      ]
    });

    // Scenario 4
    hovered = {
      top: 284.1875,
      bottom: 328.1875,
      left: 0,
      right: 149.90625,
      centerX: 74.953125,
      centerY: 306.1875,
      width: 149.90625,
      height: 44
    };
    distances = calculateDistances(selected, hovered);
    expect(distances).toStrictEqual({
      distances: [
        {
          isCentered: false,
          isOverlaped: true,
          placement: 'top',
          position: { height: 85.1875, left: 74.953125, top: 199, width: 2 },
          value: 85.19
        },
        {
          isCentered: false,
          isOverlaped: true,
          placement: 'bottom',
          position: { height: 102.8125, left: 74.953125, top: 328.1875, width: 2 },
          value: 102.81
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'left',
          position: { height: 2, left: 149.90625, top: 315, width: 332.59375 },
          value: 332.59
        }
      ],
      projections: [
        { placement: 'top', position: { height: 2, left: 74.953125, top: 199, width: 407.546875 } },
        { placement: 'bottom', position: { height: 2, left: 74.953125, top: 429, width: 407.546875 } }
      ]
    });
  });
});
