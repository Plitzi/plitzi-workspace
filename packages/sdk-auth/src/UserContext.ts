import { createContext } from 'react';

import type { UserContextValue } from '@plitzi/sdk-shared';

const userContextDefaultValue = {} as UserContextValue;

const UserContext = createContext<UserContextValue>(userContextDefaultValue);

export default UserContext;
