// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { OBJECT_FIT } from '@plitzi/sdk-shared/style/StyleConstants';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   value: string;
 *   onChange?: (value: { type: string; value: string }) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const SizeFit = props => {
  const { value, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue), [onChange]);

  const items = useMemo(
    () => [
      {
        type: 'select',
        value,
        extraValue: { type: OBJECT_FIT },
        children: (
          <>
            <option value="fill">Fill</option>
            <option value="contain">Contain</option>
            <option value="cover">Cover</option>
            <option value="none">None</option>
            <option value="scale-down">Scale Down</option>
          </>
        )
      }
    ],
    [value]
  );

  return (
    <GroupButtons
      className="w-full"
      classNameContainer="w-[180px]"
      keyValue={OBJECT_FIT}
      items={items}
      label="Object Fit"
      onChange={handleChange}
    />
  );
};

export default SizeFit;
