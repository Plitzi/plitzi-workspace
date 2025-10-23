export type UserContextValue = {
  login?: unknown;
  logout?: unknown;
  refreshDetails?: unknown;
  can?: (permission: string) => boolean;
  authenticated: boolean;
  user?: {
    details?: {
      id: number;
      username: string;
      email: string;
      verified: boolean;
      permissions: string[];
      roles: string[];
    };
    accessToken?: string | Promise<string>;
  };
};
