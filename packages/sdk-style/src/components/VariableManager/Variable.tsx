import type { StyleVariableValues } from '@plitzi/sdk-shared';

export type VariableProps = {
  values: StyleVariableValues;
};

const Variable = ({ values }: VariableProps) => {
  console.log(values);

  return <div>Variable</div>;
};

export default Variable;
