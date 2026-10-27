import { RunRefusal } from '../../runs/refusal';

/** What one path of a look may say for itself, as the look's own flags say it for every path. */
export interface PathVisitor {
  as?: string;
  guest?: boolean;
  status?: number;
}

/** The paths a look reads the same way: one look each, the next told what the ones before covered. */
export interface PathGroup {
  paths: string[];
  visitor: PathVisitor;
}

/**
 * `task look <task> "/moderation --as juno --status 403" "/withheld --as juno"`: a path with the visitor and the status
 * it is read with, written as the look's own flags — a page drawn for two visitors is one look, where encore-12's
 * designer took a look a path, each saying the other was not looked at. Paths that say the same are looked at together,
 * in the order first written; one that says nothing reads as the look's flags say.
 */
export const pathGroups = (written: readonly string[]): PathGroup[] => {
  const groups: PathGroup[] = [];
  for (const each of written) {
    const [path, ...words] = each.trim().split(/\s+/);
    const visitor: PathVisitor = {};
    for (let index = 0; index < words.length; index += 1) {
      const word = words[index];
      const value = words.at(index + 1);
      if (word === '--guest') {
        visitor.guest = true;
      } else if (word === '--as' && value !== undefined) {
        visitor.as = value;
        index += 1;
      } else if (word === '--status' && value !== undefined && /^\d{3}$/.test(value)) {
        visitor.status = Number(value);
        index += 1;
      } else {
        throw new RunRefusal(
          'invalid',
          `"${each}": a path says only who reads it and what it is sent with — "${path} --as <account>", "--guest", "--status <code>"`
        );
      }
    }

    if (visitor.as !== undefined && visitor.guest === true) {
      throw new RunRefusal('invalid', `"${each}": --as or --guest, not both`);
    }

    const same = groups.find(group => JSON.stringify(group.visitor) === JSON.stringify(visitor));
    if (same) {
      same.paths.push(path);
    } else {
      groups.push({ paths: [path], visitor });
    }
  }

  return groups;
};
