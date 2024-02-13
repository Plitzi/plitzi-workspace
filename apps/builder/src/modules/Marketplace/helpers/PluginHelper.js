export const parsePlugin = pluginRaw => {
  const { name, description, type, market, revisions, version, latestVersion, createdAt, updatedAt } = pluginRaw;
  const { icon, backgroundColor, owner, category, verified, website } = market;

  return {
    name,
    description,
    type,
    latestVersion: latestVersion.version,
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
