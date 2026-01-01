import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';
import Icon from '@plitzi/plitzi-ui/Icon';

import Variable from './Variable';

import type { StyleVariable } from '@plitzi/sdk-shared';

export type VariableGroupProps = {
  title?: string;
  variables?: StyleVariable;
};

const VariableGroup = ({ title, variables }: VariableGroupProps) => {
  return (
    <ContainerCollapsable collapsed>
      <ContainerCollapsable.Header
        className="h-6 text-sm"
        title={
          <span className="font-bold">
            {title} <span className="text-xs font-normal text-gray-500">({Object.keys(variables ?? {}).length})</span>
          </span>
        }
        placement="right"
        iconCollapsed={<Icon icon="fa-solid fa-angle-down" />}
        iconExpanded={<Icon icon="fa-solid fa-angle-up" />}
      >
        {/* <InspectorDots styleKeys={dotKeys} /> */}
      </ContainerCollapsable.Header>
      <ContainerCollapsable.Content className="flex flex-col gap-3 py-2">
        {Object.values(variables ?? {}).map((variable, i) => (
          <Variable key={`${title}-${i}`} values={variable} />
        ))}
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default VariableGroup;
