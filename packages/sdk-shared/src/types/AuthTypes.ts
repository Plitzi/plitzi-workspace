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

export type TokenResult = {
  accessToken: string;
  expiresAt: number | null;
  refreshToken: string | null;
};

export type AuthContextValue = {
  login: (...args: unknown[]) => Promise<TokenResult | undefined>;
  refresh: (...args: unknown[]) => Promise<TokenResult | undefined>;
  can: (permission: string) => boolean;
  logout: (...args: unknown[]) => Promise<void>;
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
    accessToken?: string;
  };
};
