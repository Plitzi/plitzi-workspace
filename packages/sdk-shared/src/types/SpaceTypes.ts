import type { Environment } from './CommonTypes';

export type SpaceCredentialProvider = 's3' | 'r2' | 'ssr';

export type SpaceCredential = {
  identifier: string;
  name: string;
  provider: SpaceCredentialProvider;
  inUse: boolean;
  usedIn: {
    usedFrom: string;
    name: string;
  }[];
  createdAt: number;
  updatedAt: number;
};

export type SpaceDeployment = {
  id: number;
  environment: Environment;
  revision: number | null;
  domain: string;
  isVerified: boolean;
  default: boolean;
  credential: SpaceCredential | null;
  createdAt: number;
  updatedAt: number;
};
