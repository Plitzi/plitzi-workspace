// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import noop from 'lodash/noop';
import Input from '@plitzi/plitzi-ui-components/Input';

// Alias
import InspectorLabel from '@pmodules/Style/StyleInspector/InspectorLabel';
import InputAngle from '@pcomponents/InputAngle/InputAngle';

const LinearGradientMode = props => {
  const { partialValue, onChange = noop } = props;

  const handleChangeImage = useCallback(e => onChange(e.target.value), [onChange]);

  const backgroundImage = useMemo(
    () => get(partialValue.match(/\((?<content>.*)\)/im), 'groups.content', ''),
    [partialValue]
  );

  return (
    <>
      <div className="flex">
        <InspectorLabel label="Angle" />
        <InputAngle />
      </div>
      <div className="flex">
        <InspectorLabel label="Linear Gradient" sectionTitle />
        <Input type="text" value={backgroundImage} onChange={handleChangeImage} inputClassName="rounded-b rounded-tr" />
      </div>
    </>
  );
};

LinearGradientMode.propTypes = {
  partialValue: PropTypes.string,
  onChange: PropTypes.func
};

export default LinearGradientMode;
