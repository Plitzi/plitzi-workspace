import { createContext } from 'react';

export type UserContextValue = {
  login?: unknown;
  logout?: unknown;
  refreshDetails?: unknown;
  can?: (permission: string) => boolean;
  authenticated: boolean;
  user?: { details?: Record<string, unknown>; accessToken?: string | Promise<string> };
};

const userContextDefaultValue = {} as UserContextValue;

const UserContext = createContext<UserContextValue>(userContextDefaultValue);

export default UserContext;
