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
          isOverlaped: true,
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
          isOverlaped: true,
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
          isOverlaped: true,
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
          isOverlaped: true,
          placement: 'top',
          position: { height: 130, left: 720, top: 69, width: 2 },
          value: 130
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'left',
          position: { height: 2, left: 149.90625, top: 315, width: 454.09375 },
          value: 454.09375
        }
      ],
      projections: [
        { position: { height: 2, left: 149.90625, top: 67, width: 570.09375 } },
        { position: { height: 246, left: 149.90625, top: 69, width: 2 } }
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
          isOverlaped: true,
          placement: 'top',
          position: { height: 130, left: 720, top: 69, width: 2 },
          value: 130
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'right',
          position: { height: 2, left: 836, top: 315, width: 454.09375 },
          value: 454.09375
        }
      ],
      projections: [
        { position: { height: 2, left: 720, top: 67, width: 570.09375 } },
        { position: { height: 246, left: 1290.09375, top: 69, width: 2 } }
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
          value: 454.09375
        }
      ],
      projections: [
        { position: { height: 2, left: 149.90625, top: 561, width: 570.09375 } },
        { position: { height: 246, left: 149.90625, top: 315, width: 2 } }
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
          value: 454.09375
        }
      ],
      projections: [
        { position: { height: 2, left: 720, top: 561, width: 570.09375 } },
        { position: { height: 246, left: 1290.09375, top: 315, width: 2 } }
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
          isOverlaped: true,
          placement: 'top',
          position: { height: 44.5, left: 720, top: 154.5, width: 2 },
          value: 44.5
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'left',
          position: { height: 2, left: 604, top: 132.5, width: 41 },
          value: 41
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'right',
          position: { height: 2, left: 795, top: 132.5, width: 41 },
          value: 41
        }
      ],
      projections: [
        { position: { height: 66.5, left: 604, top: 132.5, width: 2 } },
        { position: { height: 66.5, left: 834, top: 132.5, width: 2 } }
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
          isOverlaped: false,
          placement: 'left',
          position: { height: 2, left: 604, top: 522.5, width: 41 },
          value: 41
        },
        {
          isCentered: false,
          isOverlaped: false,
          placement: 'right',
          position: { height: 2, left: 795, top: 522.5, width: 41 },
          value: 41
        }
      ],
      projections: [
        { position: { height: 91.5, left: 604, top: 431, width: 2 } },
        { position: { height: 91.5, left: 834, top: 431, width: 2 } }
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
          value: 332.59375
        }
      ],
      projections: [
        { position: { height: 2, left: 598.5, top: 149, width: 448.59375 } },
        { position: { height: 2, left: 714.5, top: 429, width: 407.546875 } }
      ]
    });
  });
});
