import StyleInspector from '../../StyleInspector/StyleInspector';

import type { Style } from '@plitzi/sdk-shared';

export type ManagerModeBasicProps = {
  style: Style;
  selected: string;
  displayMode: string;
};

const ManagerModeBasic = ({ style, selected, displayMode }: ManagerModeBasicProps) => {
  return (
    <div className="flex flex-col grow basis-0 overflow-auto">
      {/* {selected && <StyleInspector mode="manager" styleSelectors={{ base: selected }} allowStyleSelector={false} />} */}
      {!selected && (
        <div className="m-3 p-3 border-2 border-dashed border-gray-300 rounded-sm text-center select-none">
          No selector or element selected. Click on one to select it.
        </div>
      )}
    </div>
  );
};

export default ManagerModeBasic;
