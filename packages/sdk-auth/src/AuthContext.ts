import { sharedContext } from '@plitzi/sdk-shared/helpers/sharedContext';

import type { AuthContextValue } from '@plitzi/sdk-shared';

const authContextDefaultValue = {} as AuthContextValue;

export const AuthContext = sharedContext('AuthContext', authContextDefaultValue);

export default AuthContext;
