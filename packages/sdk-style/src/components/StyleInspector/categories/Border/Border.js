// Packages
import React, { memo, useCallback, use, useState } from 'react';
import noop from 'lodash/noop';

// Monorepo
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
} from '@plitzi/sdk-shared/style';

// Relatives
import StyleInspectorContext from '../../StyleInspectorContext';
import BorderStyle from './BorderStyle';
import BorderRadius from './BorderRadius';
import BorderPlacements from './BorderPlacements';
import BorderWidth from './BorderWidth';
import BorderColor from './BorderColor';
import CategoryContainer from '../../../components/CategoryContainer';
import useInspectorValues from '../../hooks/useInspectorValues';

const BORDER_TOP = 'top';
const BORDER_BOTTOM = 'bottom';
const BORDER_LEFT = 'left';
const BORDER_RIGHT = 'right';
const BORDER_ALL = 'all';

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
];

/**
 * @param {{
 *   isCollapsed?: boolean;
 *   onCollapse?: (category: string, collapsed: boolean) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Border = props => {
  const { isCollapsed = true, onCollapse = noop } = props;
  const [currentPlacement, setCurrentPlacement] = useState(BORDER_ALL);
  const { setValue } = use(StyleInspectorContext);
  const values = useInspectorValues({ keys: dotKeys, asValue: true });

  const handleChange = useCallback(
    (type, partialValue) => {
      switch (type) {
        case 'radius': {
          setValue(
            [BORDER_RADIUS_TOP_LEFT, BORDER_RADIUS_TOP_RIGHT, BORDER_RADIUS_BOTTOM_LEFT, BORDER_RADIUS_BOTTOM_RIGHT],
            {
              [BORDER_RADIUS_TOP_LEFT]: partialValue,
              [BORDER_RADIUS_TOP_RIGHT]: partialValue,
              [BORDER_RADIUS_BOTTOM_LEFT]: partialValue,
              [BORDER_RADIUS_BOTTOM_RIGHT]: partialValue
            }
          );

          break;
        }

        case BORDER_RADIUS_TOP_LEFT:
        case BORDER_RADIUS_TOP_RIGHT:
        case BORDER_RADIUS_BOTTOM_LEFT:
        case BORDER_RADIUS_BOTTOM_RIGHT: {
          setValue(type, partialValue);

          break;
        }

        case 'style':
        case 'color':
        case 'width': {
          const options = ['style', 'color', 'width'].filter(part => part !== type);
          if (currentPlacement === BORDER_ALL) {
            setValue(
              [
                `border-${BORDER_TOP}-${type}`,
                `border-${BORDER_BOTTOM}-${type}`,
                `border-${BORDER_LEFT}-${type}`,
                `border-${BORDER_RIGHT}-${type}`,

                `border-${BORDER_TOP}-${options[0]}`,
                `border-${BORDER_BOTTOM}-${options[0]}`,
                `border-${BORDER_LEFT}-${options[0]}`,
                `border-${BORDER_RIGHT}-${options[0]}`,

                `border-${BORDER_TOP}-${options[1]}`,
                `border-${BORDER_BOTTOM}-${options[1]}`,
                `border-${BORDER_LEFT}-${options[1]}`,
                `border-${BORDER_RIGHT}-${options[1]}`
              ],
              {
                [`border-${BORDER_TOP}-${type}`]: partialValue,
                [`border-${BORDER_BOTTOM}-${type}`]: partialValue,
                [`border-${BORDER_LEFT}-${type}`]: partialValue,
                [`border-${BORDER_RIGHT}-${type}`]: partialValue,

                [`border-${BORDER_TOP}-${options[0]}`]: values[`border-${BORDER_TOP}-${options[0]}`],
                [`border-${BORDER_BOTTOM}-${options[0]}`]: values[`border-${BORDER_BOTTOM}-${options[0]}`],
                [`border-${BORDER_LEFT}-${options[0]}`]: values[`border-${BORDER_LEFT}-${options[0]}`],
                [`border-${BORDER_RIGHT}-${options[0]}`]: values[`border-${BORDER_RIGHT}-${options[0]}`],

                [`border-${BORDER_TOP}-${options[1]}`]: values[`border-${BORDER_RIGHT}-${options[1]}`],
                [`border-${BORDER_BOTTOM}-${options[1]}`]: values[`border-${BORDER_BOTTOM}-${options[1]}`],
                [`border-${BORDER_LEFT}-${options[1]}`]: values[`border-${BORDER_LEFT}-${options[1]}`],
                [`border-${BORDER_RIGHT}-${options[1]}`]: values[`border-${BORDER_RIGHT}-${options[1]}`]
              }
            );
          } else {
            setValue(
              [
                [`border-${currentPlacement}-${type}`],
                [`border-${currentPlacement}-${options[0]}`],
                [`border-${currentPlacement}-${options[1]}`]
              ],
              {
                [`border-${currentPlacement}-${type}`]: partialValue,
                [`border-${currentPlacement}-${options[0]}`]: values[`border-${currentPlacement}-${options[0]}`],
                [`border-${currentPlacement}-${options[1]}`]: values[`border-${currentPlacement}-${options[1]}`]
              }
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

  const handleCollapse = useCallback(isCollapsed => onCollapse('border', isCollapsed), [onCollapse]);

  return (
    <CategoryContainer title="Border" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="flex flex-col p-2 gap-2">
        <BorderRadius values={values} onChange={handleChange} />
        <div className="flex flex-col w-full gap-2">
          <BorderPlacements currentPlacement={currentPlacement} setCurrentPlacement={setCurrentPlacement} />
          <div className="flex flex-col w-full gap-2">
            <BorderStyle values={values} currentPlacement={currentPlacement} onChange={handleChange} />
            <BorderWidth values={values} currentPlacement={currentPlacement} onChange={handleChange} />
            <BorderColor values={values} currentPlacement={currentPlacement} onChange={handleChange} />
          </div>
        </div>
      </div>
    </CategoryContainer>
  );
};

export default memo(Border);
