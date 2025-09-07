import type { MarketPlacePluginRaw, MarketPlacePlugin } from '../types';

export const parsePlugin = (pluginRaw: MarketPlacePluginRaw): MarketPlacePlugin => {
  const { name, description, type, market, revisions, version, latestVersion, createdAt, updatedAt } = pluginRaw;
  const { icon, backgroundColor, owner, category, verified, website } = market;

  return {
    name,
    description,
    type,
    latestVersion: latestVersion?.version,
    version,
    owner,
    verified,
    category: category.name,
    color: backgroundColor,
    icon,
    website,
    revisions,
    createdAt,
    updatedAt
  };
};
