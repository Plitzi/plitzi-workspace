export type MarketPlacePluginRaw = {
  name: string;
  description: string;
  type: string;
  latestVersion: { version: string; createdAt: number; updatedAt: number };
  version: string;
  revisions: { version: string }[];
  market: {
    icon: string;
    backgroundColor: string;
    owner: string;
    category: { name: string };
    verified: boolean;
    website: string;
  };
  createdAt: number;
  updatedAt: number;
};

export type MarketPlacePlugin = {
  name: string;
  description: string;
  type: string;
  latestVersion: string;
  version: string;
  owner: string;
  verified: boolean;
  category: string;
  color: string;
  icon: string;
  website: string;
  revisions: { version: string }[];
  createdAt: number;
  updatedAt: number;
};
