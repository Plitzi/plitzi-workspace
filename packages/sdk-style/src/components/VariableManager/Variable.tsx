import type { StyleVariableValue } from '@plitzi/sdk-shared';

export type VariableProps = {
  values: StyleVariableValue;
};

const Variable = ({ values }: VariableProps) => {
  console.log(values);

  return <div>Variable</div>;
};

export default Variable;
