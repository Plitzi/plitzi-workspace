// import Input from '@plitzi/plitzi-ui/Input';
// import get from 'lodash/get.js';
// import { useCallback, useMemo } from 'react';

// import InputAngle from '@pcomponents/InputAngle/InputAngle';
// import InspectorLabel from '@pmodules/Style/StyleInspector/InspectorLabel';

// import type { ChangeEvent } from 'react';

export type LinearGradientModeProps = {
  partialValue: string;
  onChange?: (value: string) => void;
};

const LinearGradientMode = (/* { partialValue, onChange }: LinearGradientModeProps */) => {
  // const handleChangeImage = useCallback((value: string) => onChange?.(value), [onChange]);

  // const backgroundImage = useMemo(
  //   () => get(partialValue.match(/\((?<content>.*)\)/im), 'groups.content', ''),
  //   [partialValue]
  // );

  return (
    <>
      {/* <div className="flex">
        <InspectorLabel label="Angle" />
        <InputAngle />
      </div>
      <div className="flex">
        <InspectorLabel label="Linear Gradient" sectionTitle />
        <Input type="text" value={backgroundImage} onChange={handleChangeImage} inputClassName="rounded-b rounded-tr" />
      </div> */}
    </>
  );
};

export default LinearGradientMode;
