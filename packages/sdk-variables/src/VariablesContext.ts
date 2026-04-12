import { createContext } from 'react';

const variablesContextDefaultValue = undefined;

const VariablesContext = createContext(variablesContextDefaultValue);
VariablesContext.displayName = 'VariablesContext';

export default VariablesContext;
