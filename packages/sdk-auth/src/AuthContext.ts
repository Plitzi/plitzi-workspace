import { createContext } from 'react';

import type { AuthContextValue } from '@plitzi/sdk-shared';

const authContextDefaultValue = {} as AuthContextValue;

export const AuthContext = createContext<AuthContextValue>(authContextDefaultValue);

export default AuthContext;
