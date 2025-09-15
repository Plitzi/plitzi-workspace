import { memo, useCallback, use, useState } from 'react';

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
  'border-top-style',
  'border-top-width',
  'border-top-color',
  'border-bottom-style',
  'border-bottom-width',
  'border-bottom-color',
  'border-left-style',
  'border-left-width',
  'border-left-color',
  'border-right-style',
  'border-right-width',
  'border-right-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius'
] as StyleCategory[];

export type BorderProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Border = ({ replaceTokens = false, isCollapsed = true, onCollapse }: BorderProps) => {
  const [currentPlacement, setCurrentPlacement] = useState<'all' | 'top' | 'bottom' | 'left' | 'right'>('all');
  const { setValue } = use(StyleInspectorContext);
  const values = useInspectorValues({ keys: dotKeys, asValue: true, replaceTokens }) as Record<
    StyleCategory,
    StyleValue | undefined
  >;

  const handleChange = useCallback(
    (type: 'radius' | 'color' | 'style' | 'width' | StyleCategory) =>
      (partialValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
        switch (type) {
          case 'radius': {
            setValue(
              [
                'border-top-left-radius',
                'border-top-right-radius',
                'border-bottom-left-radius',
                'border-bottom-right-radius'
              ],
              {
                ['border-top-left-radius']: partialValue,
                ['border-top-right-radius']: partialValue,
                ['border-bottom-left-radius']: partialValue,
                ['border-bottom-right-radius']: partialValue
              } as Record<StyleCategory, StyleValue>
            );

            break;
          }

          case 'border-top-left-radius':
          case 'border-top-right-radius':
          case 'border-bottom-left-radius':
          case 'border-bottom-right-radius': {
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
        <div className="flex w-full flex-col gap-2">
          <BorderPlacements currentPlacement={currentPlacement} setCurrentPlacement={setCurrentPlacement} />
          <div className="flex w-full flex-col gap-2">
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
