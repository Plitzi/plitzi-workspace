import { lstatSync, readdirSync, readlinkSync, realpathSync } from 'node:fs';
import path from 'node:path';

export type Portal = {
  /** The package, as imported: `@plitzi/nexus`. */
  name: string;
  /** Where it really is, on this machine. */
  target: string;
  /** The link in `node_modules`, relative to the workspace root, and what it says. */
  link: string;
  linkTarget: string;
};

/**
 * The scoped packages the workspace takes from outside itself — Yarn `portal:` links. They change what a run measures
 * (a package under development instead of the published one), so every result records them.
 */
export const findPortals = (workspaceRoot: string): Portal[] => {
  const modules = path.join(workspaceRoot, 'node_modules');
  const scopes = readdirSync(modules).filter(entry => entry.startsWith('@'));

  return scopes.flatMap(scope =>
    readdirSync(path.join(modules, scope)).flatMap(name => {
      const link = path.join(modules, scope, name);
      if (!lstatSync(link).isSymbolicLink()) {
        return [];
      }

      const target = realpathSync(link);
      if (target.startsWith(`${workspaceRoot}${path.sep}`)) {
        return [];
      }

      return [
        {
          name: `${scope}/${name}`,
          target,
          link: path.relative(workspaceRoot, link),
          linkTarget: readlinkSync(link)
        }
      ];
    })
  );
};
