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
