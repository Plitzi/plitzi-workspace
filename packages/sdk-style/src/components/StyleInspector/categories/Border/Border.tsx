import { memo, useCallback, use, useState } from 'react';

import {
  BORDER_TOP_STYLE,
  BORDER_TOP_WIDTH,
  BORDER_TOP_COLOR,
  BORDER_BOTTOM_STYLE,
  BORDER_BOTTOM_WIDTH,
  BORDER_BOTTOM_COLOR,
  BORDER_LEFT_STYLE,
  BORDER_LEFT_WIDTH,
  BORDER_LEFT_COLOR,
  BORDER_RIGHT_STYLE,
  BORDER_RIGHT_WIDTH,
  BORDER_RIGHT_COLOR,
  BORDER_RADIUS_TOP_LEFT,
  BORDER_RADIUS_TOP_RIGHT,
  BORDER_RADIUS_BOTTOM_LEFT,
  BORDER_RADIUS_BOTTOM_RIGHT
} from '@plitzi/sdk-shared/style/styleConstants';

import BorderColor from './BorderColor';
import BorderPlacements from './BorderPlacements';
import BorderRadius from './BorderRadius';
import BorderStyle from './BorderStyle';
import BorderWidth from './BorderWidth';
import CategoryContainer from '../../components/CategoryContainer';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const dotKeys = [
  BORDER_TOP_STYLE,
  BORDER_TOP_WIDTH,
  BORDER_TOP_COLOR,
  BORDER_BOTTOM_STYLE,
  BORDER_BOTTOM_WIDTH,
  BORDER_BOTTOM_COLOR,
  BORDER_LEFT_STYLE,
  BORDER_LEFT_WIDTH,
  BORDER_LEFT_COLOR,
  BORDER_RIGHT_STYLE,
  BORDER_RIGHT_WIDTH,
  BORDER_RIGHT_COLOR,
  BORDER_RADIUS_TOP_LEFT,
  BORDER_RADIUS_TOP_RIGHT,
  BORDER_RADIUS_BOTTOM_LEFT,
  BORDER_RADIUS_BOTTOM_RIGHT
] as StyleCategory[];

export type BorderProps = {
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Border = ({ isCollapsed = true, onCollapse }: BorderProps) => {
  const [currentPlacement, setCurrentPlacement] = useState<'all' | 'top' | 'bottom' | 'left' | 'right'>('all');
  const { setValue } = use(StyleInspectorContext);
  const values = useInspectorValues({ keys: dotKeys, asValue: true }) as Record<StyleCategory, StyleValue | undefined>;

  const handleChange = useCallback(
    (type: 'radius' | 'color' | 'style' | 'width' | StyleCategory) =>
      (partialValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
        switch (type) {
          case 'radius': {
            setValue(
              [BORDER_RADIUS_TOP_LEFT, BORDER_RADIUS_TOP_RIGHT, BORDER_RADIUS_BOTTOM_LEFT, BORDER_RADIUS_BOTTOM_RIGHT],
              {
                [BORDER_RADIUS_TOP_LEFT]: partialValue,
                [BORDER_RADIUS_TOP_RIGHT]: partialValue,
                [BORDER_RADIUS_BOTTOM_LEFT]: partialValue,
                [BORDER_RADIUS_BOTTOM_RIGHT]: partialValue
              } as Record<StyleCategory, StyleValue>
            );

            break;
          }

          case BORDER_RADIUS_TOP_LEFT:
          case BORDER_RADIUS_TOP_RIGHT:
          case BORDER_RADIUS_BOTTOM_LEFT:
          case BORDER_RADIUS_BOTTOM_RIGHT: {
            setValue(type, partialValue as StyleValue);

            break;
          }

          case 'style':
          case 'color':
          case 'width': {
            const options = (['style', 'color', 'width'] as const).filter(part => part !== type);
            if (currentPlacement === 'all') {
              setValue(
                [
                  `border-top-${type}`,
                  `border-bottom-${type}`,
                  `border-left-${type}`,
                  `border-right-${type}`,

                  `border-top-${options[0]}`,
                  `border-bottom-${options[0]}`,
                  `border-left-${options[0]}`,
                  `border-right-${options[0]}`,

                  `border-top-${options[1]}`,
                  `border-bottom-${options[1]}`,
                  `border-left-${options[1]}`,
                  `border-right-${options[1]}`
                ],
                {
                  [`border-top-${type}`]: partialValue,
                  [`border-bottom-${type}`]: partialValue,
                  [`border-left-${type}`]: partialValue,
                  [`border-right-${type}`]: partialValue,

                  [`border-top-${options[0]}`]: values[`border-top-${options[0]}`],
                  [`border-bottom-${options[0]}`]: values[`border-bottom-${options[0]}`],
                  [`border-left-${options[0]}`]: values[`border-left-${options[0]}`],
                  [`border-right-${options[0]}`]: values[`border-right-${options[0]}`],

                  [`border-top-${options[1]}`]: values[`border-right-${options[1]}`],
                  [`border-bottom-${options[1]}`]: values[`border-bottom-${options[1]}`],
                  [`border-left-${options[1]}`]: values[`border-left-${options[1]}`],
                  [`border-right-${options[1]}`]: values[`border-right-${options[1]}`]
                } as Record<StyleCategory, StyleValue>
              );
            } else {
              setValue(
                [
                  `border-${currentPlacement}-${type}`,
                  `border-${currentPlacement}-${options[0]}`,
                  `border-${currentPlacement}-${options[1]}`
                ],
                {
                  [`border-${currentPlacement}-${type}`]: partialValue,
                  [`border-${currentPlacement}-${options[0]}`]: values[`border-${currentPlacement}-${options[0]}`],
                  [`border-${currentPlacement}-${options[1]}`]: values[`border-${currentPlacement}-${options[1]}`]
                } as Record<StyleCategory, StyleValue>
              );
            }

            break;
          }

          default:
            break;
        }
      },
    [currentPlacement, values, setValue]
  );

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('border', isCollapsed), [onCollapse]);

  return (
    <CategoryContainer title="Border" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="flex flex-col gap-2">
        <BorderRadius values={values} onChange={handleChange('radius')} onChangeSegment={handleChange} />
        <div className="flex flex-col w-full gap-2">
          <BorderPlacements currentPlacement={currentPlacement} setCurrentPlacement={setCurrentPlacement} />
          <div className="flex flex-col w-full gap-2">
            <BorderStyle values={values} currentPlacement={currentPlacement} onChange={handleChange('style')} />
            <BorderWidth values={values} currentPlacement={currentPlacement} onChange={handleChange('width')} />
            <BorderColor values={values} currentPlacement={currentPlacement} onChange={handleChange('color')} />
          </div>
        </div>
      </div>
    </CategoryContainer>
  );
};

export default memo(Border);
