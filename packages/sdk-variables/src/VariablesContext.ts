import { sharedContext } from '@plitzi/sdk-shared/react';

const variablesContextDefaultValue = undefined;

const VariablesContext = sharedContext('VariablesContext', variablesContextDefaultValue);

export default VariablesContext;
