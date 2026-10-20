import { describe, test, expect } from 'vitest';

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
        { position: { height: 2, left: 654, top: 221.5, width: 66 }, placement: 'top' },
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
        { position: { height: 2, left: 720, top: 221.5, width: 66 }, placement: 'top' },
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
});
