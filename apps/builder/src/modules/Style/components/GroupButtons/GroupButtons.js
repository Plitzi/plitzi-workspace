// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import noop from 'lodash/noop';

// Relatives
import InspectorLabel from '../../StyleInspector/InspectorLabel';
import GroupButton from './types/GroupButton';
import GroupInput from './types/GroupInput';
import GroupInputMetric from './types/GroupInputMetric';
import GroupSelect from './types/GroupSelect';
import GroupColor from './types/GroupColor';

const keyValueDefault = [];
const itemsDefault = [];

const GroupButtons = props => {
  const {
    className = '',
    classNameContainer = '',
    label = 'Title',
    keyValue = keyValueDefault,
    items = itemsDefault,
    fullWidth = false,
    onChange = noop
  } = props;

  const handleClick = useCallback(
    value => () => {
      if (!value) {
        return undefined;
      }

      return onChange(value);
    },
    [onChange]
  );

  const handleChangeInput = useCallback(
    extraValue => e => onChange({ value: e.target.value, ...extraValue }),
    [onChange]
  );

  const handleChangeDirect = useCallback(extraValue => value => onChange({ value, ...extraValue }), [onChange]);

  const itemsParsed = useMemo(
    () => items.filter(item => typeof item.isVisible !== 'boolean' || !!item.isVisible),
    [items]
  );

  return (
    <div className={classNames('flex items-center justify-between', className, { 'gap-4': fullWidth })}>
      {label && (
        <InspectorLabel className="text-sm" label={label} keyValue={keyValue}>
          {label}
        </InspectorLabel>
      )}
      {itemsParsed && itemsParsed.length > 0 && (
        <div className={classNames('flex flex-col', { 'w-full': fullWidth })}>
          <div
            className={classNames('flex bg-white border border-gray-300 rounded py-1 divide-x-2', classNameContainer, {
              'w-full': fullWidth
            })}
          >
            {itemsParsed.map((item, i) => {
              const {
                value = '',
                extraValue = {},
                children,
                description = '',
                active = false,
                type = 'button',
                inputProps = {}
              } = item;

              switch (type) {
                case 'input':
                  return <GroupInput key={i} value={value} onChange={handleChangeInput(extraValue)} {...inputProps} />;

                case 'inputMetric':
                  return (
                    <GroupInputMetric key={i} value={value} onChange={handleChangeDirect(extraValue)} {...inputProps} />
                  );

                case 'select':
                  return (
                    <GroupSelect key={i} value={value} onChange={handleChangeInput(extraValue)} {...inputProps}>
                      {children}
                    </GroupSelect>
                  );

                case 'color':
                  return (
                    <GroupColor key={i} value={value} onChange={handleChangeDirect(extraValue)} {...inputProps}>
                      {children}
                    </GroupColor>
                  );

                case 'button':
                default:
                  return (
                    <GroupButton key={i} title={description} active={active} onClick={handleClick(value)}>
                      {children}
                    </GroupButton>
                  );
              }
            })}
          </div>
          {itemsParsed.filter(item => !!item.label).length > 0 && (
            <div className="flex">
              {itemsParsed.map((item, i) => {
                const { label, keyValue } = item;
                if (!label) {
                  return undefined;
                }

                return (
                  <div key={i} className="flex items-center justify-center grow basis-0 cursor-pointer">
                    <InspectorLabel className="!min-w-0" keyValue={keyValue}>
                      {label}
                    </InspectorLabel>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

GroupButtons.propTypes = {
  className: PropTypes.string,
  classNameContainer: PropTypes.string,
  label: PropTypes.string,
  keyValue: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  items: PropTypes.array,
  fullWidth: PropTypes.bool,
  onChange: PropTypes.func
};

export default GroupButtons;
