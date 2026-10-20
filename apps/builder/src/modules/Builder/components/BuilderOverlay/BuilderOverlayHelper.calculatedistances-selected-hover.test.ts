import { describe, test, expect } from 'vitest';

import { calculateDistances } from './BuilderOverlayHelper';

describe('Testing BuilderOverlayHelper', () => {
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
        { position: { height: 2, left: 598.5, top: 151, width: 448.59375 }, placement: 'top' },
        { position: { height: 2, left: 714.5, top: 431, width: 407.546875 }, placement: 'bottom' }
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
        { placement: 'top', position: { height: 2, left: 598.5, top: 187, width: 209.203125 } },
        { placement: 'bottom', position: { height: 2, left: 714.5, top: 431, width: 168.15625 } }
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
        { placement: 'bottom', position: { height: 2, left: 714.5, top: 431, width: 168.15625 } }
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
        { placement: 'bottom', position: { height: 2, left: 74.953125, top: 431, width: 407.546875 } }
      ]
    });
  });
});
