import { createContext } from 'react';

export type UserContextValue = unknown;

const userContextDefaultValue = {} as UserContextValue;

const UserContext = createContext<UserContextValue>(userContextDefaultValue);

export default UserContext;
